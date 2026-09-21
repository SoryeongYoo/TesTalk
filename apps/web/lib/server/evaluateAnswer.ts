import type Anthropic from "@anthropic-ai/sdk";
import {
  AnswerFeedbackSchema,
  buildFeedbackPrompt,
  type AnswerFeedback,
  type EvaluateAnswerQuestion,
} from "@testalk/shared";
import { getAnthropicClient } from "./anthropicClient";

/**
 * "답변 텍스트 → 평가" 피드백 엔진의 유일한 진입점.
 *
 * ★ 유료화 대비 — 피드백을 위한 Claude API 호출은 반드시 이 함수 하나로만 모은다.
 * 나중에 크레딧 게이트("잔액 확인 → 있으면 실행+차감, 없으면 402 거부")를 붙일 때는
 * 이 함수를 감싸는 얇은 래퍼 하나만 만들면 된다 — 예를 들어:
 *
 *   async function evaluateAnswerWithCredit(userId, question, answerText) {
 *     await assertHasCredit(userId);       // 크레딧 확인 (미들웨어 성격)
 *     const feedback = await evaluateAnswer(question, answerText); // 이 함수
 *     await deductCredit(userId);          // 차감
 *     return feedback;
 *   }
 *
 * 이 함수 자체는 인증/크레딧을 전혀 모른다 — 호출부(Server Action)가 여러 군데로
 * 흩어지면 게이트도 여러 번 붙여야 하므로, 새로운 화면/기능에서 피드백이 필요해도
 * Claude를 직접 호출하지 말고 반드시 이 함수를 거치게 한다.
 *
 * ⚠️ 서버 전용. "use client" 컴포넌트에서 직접 import하지 말 것 — ANTHROPIC_API_KEY를 사용한다.
 * apps/web/app/actions/evaluateAnswer.ts의 Server Action이 이 함수를 감싸서 호출한다.
 */

/** 이 파이프라인이 쓰는 모델. 개발 단계라 비용이 싼 최신 Haiku 사용 — 필요 시 이 상수만 바꾸면 된다. */
const FEEDBACK_MODEL = "claude-haiku-4-5-20251001";
const MAX_OUTPUT_TOKENS = 1024;

/** 최초 1회 + 최대 1회 재시도 = 총 2회. JSON 파싱 실패든 스키마 검증 실패든 이 안에서 재시도한다. */
const MAX_ATTEMPTS = 2;

/**
 * 문항 정보 + 사용자 답변(영어 텍스트)으로 오픽 루브릭 기반 채점 피드백을 만든다.
 *
 * @param question 채점 대상 문항 (function/topic/text_en).
 * @param answerText 사용자가 입력(또는 STT로 전사)한 영어 답변 원문.
 * @throws answerText가 비어 있거나, 재시도 후에도 유효한 피드백을 얻지 못하면 에러.
 */
export async function evaluateAnswer(
  question: EvaluateAnswerQuestion,
  answerText: string,
): Promise<AnswerFeedback> {
  const trimmedAnswer = answerText.trim();
  if (trimmedAnswer.length === 0) {
    throw new Error("[evaluateAnswer] 답변 텍스트가 비어 있습니다.");
  }

  const client = getAnthropicClient();
  const prompt = buildFeedbackPrompt(question, trimmedAnswer);

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const message = await client.messages.create({
        model: FEEDBACK_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [{ role: "user", content: prompt }],
      });
      const raw = parseJsonLoose(extractResponseText(message));
      const parsed = AnswerFeedbackSchema.safeParse(raw);

      if (parsed.success) {
        return parsed.data;
      }

      const issueSummary = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
      lastError = new Error(`피드백 스키마 검증 실패: ${issueSummary}`);
    } catch (err) {
      lastError = err;
    }

    console.warn(
      `[evaluateAnswer] 시도 ${attempt}/${MAX_ATTEMPTS} 실패: ${(lastError as Error)?.message}`,
    );
  }

  throw new Error(
    `[evaluateAnswer] ${MAX_ATTEMPTS}번 시도했지만 피드백을 만들지 못했습니다: ${(lastError as Error)?.message}`,
  );
}

/** 응답 content에서 첫 text 블록을 꺼낸다. */
function extractResponseText(message: Anthropic.Messages.Message): string {
  for (const block of message.content) {
    if (block.type === "text") {
      return block.text;
    }
  }
  throw new Error("Claude 응답에 text 블록이 없습니다.");
}

/** 마크다운 코드펜스 등으로 감싸져 오는 응답에 대비한 방어적 JSON 파싱. */
function parseJsonLoose(rawText: string): unknown {
  const withoutFences = stripCodeFences(rawText).trim();

  try {
    return JSON.parse(withoutFences);
  } catch {
    // 객체 앞뒤에 설명 문장이 붙어 온 경우, 첫 '{'부터 마지막 '}'까지만 다시 시도한다.
    const start = withoutFences.indexOf("{");
    const end = withoutFences.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(withoutFences.slice(start, end + 1));
      } catch {
        // 아래 공통 에러로 떨어진다.
      }
    }
    throw new Error(`JSON으로 파싱할 수 없는 응답: ${rawText.slice(0, 300)}`);
  }
}

function stripCodeFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1]! : text;
}
