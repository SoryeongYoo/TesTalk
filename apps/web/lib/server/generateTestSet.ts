import type Anthropic from "@anthropic-ai/sdk";
import {
  OPIC_BLUEPRINT,
  OpicQuestionSchema,
  TOPIC_ALLOCATION_GROUPS,
  allocateTopics,
  getBlueprintSlot,
  validateOpicQuestionSet,
  buildSetPrompt,
  type BlueprintSlot,
  type OpicDifficultyLevel,
  type OpicQuestion,
  type OpicValidationIssue,
  type TopicAllocationEntry,
  type TopicAllocationGroup,
} from "@testalk/shared";
import { getAnthropicClient } from "./anthropicClient";

/**
 * 세트 단위 AI 생성 + 병합 + 검증 파이프라인.
 * (참고: CLAUDE.md, docs/PLAN.md 4-2 생성 파이프라인)
 *
 * ⚠️ 서버 전용. "use client" 컴포넌트에서 직접 import하지 말 것 — ANTHROPIC_API_KEY를 사용한다.
 * apps/web/app/actions/generateTestSet.ts의 Server Action이 이 함수를 감싸서 호출한다.
 */

/** 이 파이프라인이 쓰는 모델. 최신 Sonnet — 필요 시 이 상수만 바꾸면 된다. */
const CLAUDE_MODEL = "claude-sonnet-5";
const MAX_OUTPUT_TOKENS = 2048;

/** 최초 1회 + 최대 2회 재시도(라운드) = 총 3라운드. 라운드마다 실패/불일치 세트만 다시 생성한다. */
const MAX_ROUNDS = 3;
/** 한 세트 호출 안에서 "JSON 파싱 자체가 깨졌을 때"의 즉시 재시도 여유 (라운드 재시도와 별개). */
const MAX_PARSE_RETRIES_PER_CALL = 1;

export interface GenerateTestSetResult {
  valid: boolean;
  questions: OpicQuestion[];
  issues: OpicValidationIssue[];
  /** 검증을 통과하기까지 실제로 돈 라운드 수 (1이면 재시도 없이 한 번에 성공). */
  rounds: number;
}

// slot_no=1(자기소개)은 AI 생성 없이 고정 문구를 쓴다 — PLAN.md 2-2에서 출처가 "고정"으로
// 명시된 유일한 슬롯이라 AI 호출 자체가 불필요하다. 스키마를 통과하는지 모듈 로드 시 검증한다.
const INTRO_QUESTION: OpicQuestion = OpicQuestionSchema.parse({
  slot_no: 1,
  function: "intro",
  // OpicSourceSchema는 "survey"|"surprise"만 허용해 "고정" 카테고리가 없다.
  // intro는 실질적으로 출처 구분이 무의미하므로 임의로 "survey"를 채운다.
  topic: "자기소개",
  source: "survey",
  text_en: "Let's start the interview. Tell me about yourself.",
  text_ko: "인터뷰를 시작하겠습니다. 자기소개를 해 주세요.",
});

/**
 * 사용자 설문 선택 + 난이도로 오픽 모의고사 15문항을 생성한다.
 *
 * 흐름:
 *  1. allocateTopics()로 콤보1~3/롤플레이/어드밴스 세트별 topic·source 배정
 *  2. 세트별로 buildSetPrompt() 프롬프트를 만들어 Claude를 병렬 호출
 *  3. 응답을 slot_no 순서로 병합 — slot_no·topic·source는 AI 값을 신뢰하지 않고
 *     blueprint·allocateTopics 결과로 항상 덮어쓴다. function은 AI 값을 그대로 두고
 *     validateOpicQuestionSet()의 판정에 맡긴다(임의 보정하지 않는다).
 *  4. validateOpicQuestionSet()로 최종 검증
 *  5. 실패하면 검증 issue가 가리키는 세트만 다시 생성(최대 2회 재시도), 그래도 실패하면 에러
 */
export async function generateTestSet(
  surveyTopics: readonly string[],
  difficulty: OpicDifficultyLevel,
): Promise<GenerateTestSetResult> {
  const client = getAnthropicClient();

  console.log(
    `[generateTestSet] 시작 — 설문 ${surveyTopics.length}개, 난이도 ${difficulty}, 모델 ${CLAUDE_MODEL}`,
  );

  const allocation = allocateTopics(surveyTopics, difficulty);
  for (const group of TOPIC_ALLOCATION_GROUPS) {
    console.log(
      `[generateTestSet] topic 배정 — ${group}: "${allocation[group].topic}" (${allocation[group].source})`,
    );
  }

  const slotsByGroup = Object.fromEntries(
    TOPIC_ALLOCATION_GROUPS.map((group) => [
      group,
      OPIC_BLUEPRINT.filter((slot) => slot.group === group),
    ]),
  ) as Record<TopicAllocationGroup, BlueprintSlot[]>;

  // 그룹별 최신 생성 결과. 라운드가 지나도 성공한 그룹은 그대로 유지되고,
  // 문제가 있는 그룹만 다음 라운드에서 덮어써진다.
  const setQuestions = new Map<TopicAllocationGroup, OpicQuestion[]>();
  let groupsToGenerate: TopicAllocationGroup[] = [...TOPIC_ALLOCATION_GROUPS];
  let lastIssues: OpicValidationIssue[] = [];

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    console.log(
      `[generateTestSet] === 라운드 ${round}/${MAX_ROUNDS}: [${groupsToGenerate.join(", ")}] 생성 ===`,
    );

    // 세트별 호출은 병렬로 보내되(Promise.allSettled), 이번 라운드에서 재생성이 필요한
    // 세트만 대상으로 한다 — 이미 성공한 세트를 매 라운드 다시 호출하지 않는다.
    const settled = await Promise.allSettled(
      groupsToGenerate.map((group) =>
        requestSetQuestions(
          client,
          group,
          slotsByGroup[group],
          allocation[group],
          difficulty,
        ),
      ),
    );

    const failedGroups: TopicAllocationGroup[] = [];
    settled.forEach((outcome, i) => {
      const group = groupsToGenerate[i]!;
      if (outcome.status === "fulfilled") {
        setQuestions.set(group, outcome.value);
        console.log(`[generateTestSet] [${group}] 생성 성공 (${outcome.value.length}문항)`);
      } else {
        failedGroups.push(group);
        console.warn(
          `[generateTestSet] [${group}] 생성 실패: ${(outcome.reason as Error)?.message ?? outcome.reason}`,
        );
      }
    });

    if (failedGroups.length > 0) {
      if (round === MAX_ROUNDS) {
        throw new Error(
          `[generateTestSet] ${MAX_ROUNDS}번 시도 후에도 응답을 만들지 못한 세트가 있습니다: ` +
            `[${failedGroups.join(", ")}]`,
        );
      }
      groupsToGenerate = failedGroups;
      continue;
    }

    const assembled = [
      INTRO_QUESTION,
      ...TOPIC_ALLOCATION_GROUPS.flatMap((group) => setQuestions.get(group)!),
    ].sort((a, b) => a.slot_no - b.slot_no);

    const result = validateOpicQuestionSet(assembled);
    lastIssues = result.issues;
    console.log(
      `[generateTestSet] 라운드 ${round} 검증: ${result.valid ? "PASS" : `FAIL (${result.issues.length}건)`}`,
    );
    result.issues.forEach((issue) =>
      console.warn(`[generateTestSet]   - slot ${issue.slotNo}: ${issue.message}`),
    );

    if (result.valid) {
      return { valid: true, questions: assembled, issues: [], rounds: round };
    }

    if (round === MAX_ROUNDS) {
      break;
    }

    const affectedGroups = resolveAffectedGroups(result.issues);
    if (affectedGroups.length === 0) {
      // 특정 세트로 원인을 좁힐 수 없는 문제(예: intro 슬롯, 배열 구조 자체) —
      // 세트를 재생성해도 고칠 수 없으므로 재시도 없이 바로 중단한다.
      console.warn(
        "[generateTestSet] 검증 실패를 특정 세트로 좁힐 수 없어 재시도를 중단합니다.",
      );
      break;
    }
    groupsToGenerate = affectedGroups;
  }

  throw new Error(
    `[generateTestSet] ${MAX_ROUNDS}번 시도했지만 검증을 통과하지 못했습니다. ` +
      `issues: ${JSON.stringify(lastIssues)}`,
  );
}

/** 검증 issue의 slotNo들을 blueprint로 역추적해, 재생성이 필요한 그룹 목록을 만든다. */
function resolveAffectedGroups(
  issues: readonly OpicValidationIssue[],
): TopicAllocationGroup[] {
  const groups = new Set<TopicAllocationGroup>();
  for (const issue of issues) {
    const slot = getBlueprintSlot(issue.slotNo);
    if (!slot || slot.group === "intro") {
      // slotNo가 -1(구조적 오류)이거나 intro(AI 미생성 슬롯)를 가리키면
      // 세트 재생성으로 해결할 수 없는 문제다.
      return [];
    }
    groups.add(slot.group as TopicAllocationGroup);
  }
  return [...groups];
}

/** 세트 하나를 Claude로 생성한다. JSON이 깨져서 못 읽으면 즉시 재시도한다. */
async function requestSetQuestions(
  client: Anthropic,
  group: TopicAllocationGroup,
  slots: readonly BlueprintSlot[],
  allocation: TopicAllocationEntry,
  difficulty: OpicDifficultyLevel,
): Promise<OpicQuestion[]> {
  const prompt = buildSetPrompt(group, allocation.topic, allocation.source, difficulty);

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_PARSE_RETRIES_PER_CALL; attempt++) {
    try {
      const message = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [{ role: "user", content: prompt }],
      });
      const raw = parseJsonLoose(extractResponseText(message));
      return shapeSetQuestions(group, slots, allocation, raw);
    } catch (err) {
      lastError = err;
      console.warn(
        `[generateTestSet] [${group}] 응답 파싱 실패 (시도 ${attempt + 1}/${MAX_PARSE_RETRIES_PER_CALL + 1}): ` +
          `${(err as Error).message}`,
      );
    }
  }

  throw new Error(`[${group}] Claude 응답을 파싱하지 못했습니다: ${(lastError as Error)?.message}`);
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

/**
 * AI가 슬롯 개수만큼의 배열을 돌려줬다는 전제로, slot_no/topic/source를
 * blueprint·allocateTopics 결과로 덮어쓴다. function은 AI 값을 그대로 두고
 * (임의로 고치지 않음) validateOpicQuestionSet()의 최종 판정에 맡긴다.
 */
function shapeSetQuestions(
  group: TopicAllocationGroup,
  slots: readonly BlueprintSlot[],
  allocation: TopicAllocationEntry,
  raw: unknown,
): OpicQuestion[] {
  if (!Array.isArray(raw) || raw.length !== slots.length) {
    const actualLength = Array.isArray(raw) ? raw.length : "배열 아님";
    throw new Error(`[${group}] 문항 개수가 다릅니다. 기대 ${slots.length}개, 실제 ${actualLength}`);
  }

  return slots.map((slot, i) => {
    const item = raw[i];
    if (typeof item !== "object" || item === null) {
      throw new Error(`[${group}] ${i + 1}번째 원소가 JSON 객체가 아닙니다.`);
    }
    return {
      ...(item as Record<string, unknown>),
      slot_no: slot.slotNo,
      topic: allocation.topic,
      source: allocation.source,
    } as OpicQuestion;
  });
}

/** 마크다운 코드펜스 등으로 감싸져 오는 응답에 대비한 방어적 JSON 파싱. */
function parseJsonLoose(rawText: string): unknown {
  const withoutFences = stripCodeFences(rawText).trim();

  try {
    return JSON.parse(withoutFences);
  } catch {
    // 배열 앞뒤에 설명 문장이 붙어 온 경우, 첫 '['부터 마지막 ']'까지만 다시 시도한다.
    const start = withoutFences.indexOf("[");
    const end = withoutFences.lastIndexOf("]");
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
