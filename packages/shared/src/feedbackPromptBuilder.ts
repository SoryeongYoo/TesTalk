import {
  AnswerFeedbackSchema,
  OPIC_LEVELS,
  type EvaluateAnswerQuestion,
} from "./feedback";
import { OPIC_FUNCTION_LABELS } from "./promptBuilder";

/**
 * "답변 텍스트 → 채점" 프롬프트 빌더. promptBuilder.ts(세트 생성)와 같은 원칙 —
 * Claude API를 직접 호출하지 않고 프롬프트 "문자열"만 순수하게 만든다.
 *
 * 채점 항목(과제 달성/문법/어휘/유창성)과 출력 필드는 feedback.ts의
 * AnswerFeedbackSchema가 유일한 정의처다 — 여기서 필드를 다시 나열하지 않고
 * 스키마의 shape에서 필드 순서를 파생시킨다 (CLAUDE.md 규칙 5와 동일한 원칙).
 */

// AnswerFeedbackSchema.shape에서 필드 목록을 파생시킨다 — 필드가 추가/삭제되면
// 아래 FIELD_DESCRIPTIONS의 타입 체크가 즉시 어긋나게 만들어 갱신을 강제한다.
const FEEDBACK_FIELD_ORDER = Object.keys(
  AnswerFeedbackSchema.shape,
) as (keyof typeof AnswerFeedbackSchema.shape)[];

const CRITERION_FIELD_DESCRIPTION =
  '{ "score": 1~5 사이 정수, "comment": 이 점수를 준 근거(답변 내용을 구체적으로 언급하는 한두 문장) }';

const FIELD_DESCRIPTIONS: Record<keyof typeof AnswerFeedbackSchema.shape, string> = {
  task_completion: `과제 달성(질문이 요구한 내용에 제대로 답했는가). ${CRITERION_FIELD_DESCRIPTION}`,
  grammar: `문법 정확성. ${CRITERION_FIELD_DESCRIPTION}`,
  vocabulary: `어휘 다양성/적절성. ${CRITERION_FIELD_DESCRIPTION}`,
  fluency_organization: `유창성/구성(문장 연결, 논리적 구조). ${CRITERION_FIELD_DESCRIPTION}`,
  improvements: "구체적인 개선 제안 1~2개로 이루어진 문자열 배열.",
  estimated_level: `이 답변 하나로 추정한 예상 OPIc 등급. 다음 중 하나: [${OPIC_LEVELS.join(", ")}] (낮은 순).`,
  estimated_level_comment: "estimated_level을 그렇게 판단한 근거를 한두 문장으로.",
};

/**
 * 문항 정보 + 사용자 답변(영어)으로 채점 프롬프트 문자열을 만든다.
 * 같은 입력이면 항상 같은 문자열을 반환하는 순수 함수.
 *
 * @param question 채점 대상 문항 (function/topic/text_en만 필요).
 * @param answerText 사용자가 말한(또는 입력한) 영어 답변 원문.
 */
export function buildFeedbackPrompt(
  question: EvaluateAnswerQuestion,
  answerText: string,
): string {
  const trimmedAnswer = answerText.trim();
  if (trimmedAnswer.length === 0) {
    throw new Error("[buildFeedbackPrompt] answerText는 빈 문자열일 수 없습니다.");
  }

  const functionLabel = OPIC_FUNCTION_LABELS[question.function];

  const fieldDescriptions = FEEDBACK_FIELD_ORDER.map(
    (field) => `  - ${field}: ${FIELD_DESCRIPTIONS[field]}`,
  ).join("\n");

  const lines: string[] = [
    "너는 ACTFL OPIc 시험의 숙련된 채점관이다.",
    "아래 문항에 대한 응시자의 영어 답변을 표준 ACTFL/OPIc 루브릭 기준으로 채점하라.",
    "",
    "[문항 정보]",
    `  - 유형: ${functionLabel}`,
    `  - 주제(topic): ${question.topic}`,
    `  - 질문(영문): ${question.text_en}`,
    "",
    "[응시자 답변]",
    trimmedAnswer,
    "",
    "[채점 지침]",
    "- 아래 4개 항목을 각각 1(미흡)~5(우수) 정수로 채점하고, 답변 내용에 근거한 짧은 코멘트를 남긴다.",
    "- 실제로 하지 않은 말을 한 것처럼 코멘트하지 말고, 답변에 실제로 나타난 내용만 근거로 삼는다.",
    "- 답변이 질문과 무관하거나 지나치게 짧다면 낮은 점수와 함께 그 사실을 코멘트에 명시한다.",
    "- 개선 제안은 비판이 아니라 다음 답변에 바로 적용할 수 있는 실용적인 조언으로 1~2개만 제시한다.",
    "- 설명, 마크다운, 코드펜스 없이 아래 [출력 형식]의 JSON 객체 하나만 출력한다.",
    "",
    "[출력 형식] 다음 필드를 갖는 JSON 객체:",
    fieldDescriptions,
  ];

  return lines.join("\n");
}
