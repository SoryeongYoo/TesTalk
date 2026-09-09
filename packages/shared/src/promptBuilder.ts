import { z } from "zod";
import {
  OPIC_BLUEPRINT,
  type BlueprintSlot,
  type OpicFunction,
  type TopicAllocationGroup,
} from "./blueprint";
import {
  assertFifteenQuestionMode,
  assertOpicDifficultyLevel,
  type OpicDifficultyLevel,
} from "./difficulty";
import { OpicQuestionSchema, type OpicQuestion, type OpicSource } from "./schema";

/**
 * AI 세트 생성 프롬프트 빌더. Claude API를 직접 호출하지 않는다 —
 * 세트 하나(콤보1~3 | 롤플레이 | 어드밴스) 분량의 프롬프트 "문자열"만 순수하게 만든다.
 * (참고: docs/PLAN.md 4-3 프롬프트 템플릿, 4-4 Structured Output 스키마, 5. 문제 예시)
 *
 * 슬롯 순서·유형은 이 파일이 하드코딩하지 않고 매번 OPIC_BLUEPRINT에서 읽어온다 —
 * blueprint가 바뀌면 프롬프트도 그대로 따라간다 (CLAUDE.md 규칙 1).
 */

/** 사람이 읽는 function 라벨 + 이 유형으로 무엇을 유도해야 하는지 지시문. */
interface FunctionPromptInfo {
  label: string;
  instruction: string;
}

/**
 * function별 사람이 읽는 한글 라벨. 세트 생성 프롬프트(FUNCTION_PROMPT_INFO)와
 * 피드백 채점 프롬프트(feedbackPromptBuilder.ts)가 같은 라벨을 공유하도록 여기서만
 * 정의한다 — 두 곳에 라벨을 각자 나열하면 표현이 갈라질 수 있어서다.
 *
 * Record<OpicFunction, ...> 이므로 blueprint.ts의 OPIC_FUNCTIONS에 값이 추가/제거되면
 * 이 객체도 타입 에러로 즉시 드러난다 (enum 단일 출처, CLAUDE.md 규칙 5).
 */
export const OPIC_FUNCTION_LABELS: Record<OpicFunction, string> = {
  intro: "자기소개(Self-Introduction)",
  description: "묘사(Description)",
  habit: "습관·루틴(Habit)",
  comparison: "비교(Comparison)",
  past_experience: "과거 경험(Past Experience)",
  roleplay_ask: "질문하기(Ask Questions)",
  roleplay_solve: "문제 해결(Solve a Problem)",
  roleplay_experience: "관련 경험(Related Experience)",
  advanced_compare: "비교/변화(Comparison)",
  advanced_issue: "이슈/트렌드(Issue)",
};

const FUNCTION_PROMPT_INFO: Record<OpicFunction, FunctionPromptInfo> = {
  intro: {
    label: OPIC_FUNCTION_LABELS.intro,
    instruction: "이름을 밝히지 않고 자연스럽게 자기소개를 하도록 유도한다.",
  },
  description: {
    label: OPIC_FUNCTION_LABELS.description,
    instruction: "대상(장소·사물·사람)을 최대한 구체적으로 묘사하도록 유도한다.",
  },
  habit: {
    label: OPIC_FUNCTION_LABELS.habit,
    instruction: "평소 반복하는 행동이나 루틴을 순서대로 구체적으로 말하도록 유도한다.",
  },
  comparison: {
    label: OPIC_FUNCTION_LABELS.comparison,
    instruction: "과거와 현재, 또는 서로 다른 두 대상을 비교해서 차이를 설명하도록 유도한다.",
  },
  past_experience: {
    label: OPIC_FUNCTION_LABELS.past_experience,
    instruction: "기억에 남는 구체적인 일화를 시간·장소·인물과 함께 말하도록 유도한다.",
  },
  roleplay_ask: {
    label: OPIC_FUNCTION_LABELS.roleplay_ask,
    instruction: "주어진 상황에서 필요한 정보를 얻기 위한 질문 3~4개를 하도록 지시한다.",
  },
  roleplay_solve: {
    label: OPIC_FUNCTION_LABELS.roleplay_solve,
    instruction: "돌발 상황을 제시하고, 전화를 걸어 대안을 2~3개 제시하도록 지시한다.",
  },
  roleplay_experience: {
    label: OPIC_FUNCTION_LABELS.roleplay_experience,
    instruction: "롤플레이 상황과 비슷했던 실제 경험을 이야기하도록 유도한다.",
  },
  advanced_compare: {
    label: OPIC_FUNCTION_LABELS.advanced_compare,
    instruction: "같은 주제를 과거와 현재로 비교해 변화를 상세히 설명하도록 유도한다.",
  },
  advanced_issue: {
    label: OPIC_FUNCTION_LABELS.advanced_issue,
    instruction: "주제와 관련된 사회적 이슈나 트렌드에 대한 의견을 묻는다.",
  },
};

interface GroupPromptMeta {
  /** 세트를 부르는 한글 이름. */
  label: string;
  /** 이 그룹에만 적용되는 추가 지시문 (예: 롤플레이 안내 문구). */
  extraInstruction?: string;
}

const GROUP_PROMPT_META: Record<TopicAllocationGroup, GroupPromptMeta> = {
  combo1: { label: "콤보" },
  combo2: { label: "콤보" },
  combo3: { label: "콤보" },
  roleplay: {
    label: "롤플레이",
    extraInstruction:
      '각 문항은 실제 오픽처럼 "I\'ll give you a situation and act it out." 류의 안내 문구로 시작해 상황을 설명한 뒤 지시를 준다.',
  },
  advanced: { label: "어드밴스" },
};

// schema.ts(OpicQuestionSchema)에서 필드 목록을 파생시킨다 — 필드가 추가/삭제되면
// 여기도 같이 갱신해야 한다는 걸 아래 QUESTION_FIELD_DESCRIPTIONS의 타입 체크가 강제한다.
const QUESTION_FIELD_ORDER = Object.keys(
  OpicQuestionSchema.shape,
) as (keyof OpicQuestion)[];

const QUESTION_FIELD_DESCRIPTIONS: Record<keyof OpicQuestion, string> = {
  slot_no: "이 문항의 시험 문항 번호(정수). 아래 [사용 가능한 slot_no] 목록의 값을 그대로 사용한다.",
  function:
    "이 문항의 유형(enum 문자열). 같은 슬롯에 허용된 값 중 하나와 정확히 일치해야 한다 " +
    "(형식이 실제로 일치하는지는 시스템이 별도로 재검증하므로 최대한 정확히 지정할 것).",
  topic: "이 세트의 topic 값과 정확히 동일한 문자열.",
  source: '이 세트의 source 값과 정확히 동일 ("survey" 또는 "surprise").',
  text_en: "영어 문항 텍스트. 자연스러운 구어체 인터뷰 톤으로 1~3문장.",
  text_ko: "text_en을 자연스러운 한국어로 번역한 문장 (학습자 병기용).",
};

/** 난이도에 따른 문항 톤/복잡도 가이드. (참고: docs/PLAN.md 2-1) */
function describeDifficulty(difficulty: OpicDifficultyLevel): string {
  return difficulty <= 4
    ? "IM3~IH 수준의 표준 난이도. 문장은 명확하게, 답변 범위가 너무 넓지 않게 작성하라."
    : "IH~AL 수준의 고난도. 조건(제약)이 있는 복합적인 질문으로, 더 깊은 사고와 상세한 답변을 요구하도록 작성하라.";
}

function describeSlotFunctions(slot: BlueprintSlot): string {
  return slot.allowedFunctions.map((fn) => FUNCTION_PROMPT_INFO[fn].label).join(" 또는 ");
}

function describeSlotInstruction(slot: BlueprintSlot): string {
  return slot.allowedFunctions.map((fn) => FUNCTION_PROMPT_INFO[fn].instruction).join(" / ");
}

/** slot_no만 다르고 나머지는 고정인 few-shot 예시를 검증하기 위한 부분 스키마. */
const FewShotSetSchema = z.array(OpicQuestionSchema).min(1);

// few-shot 예시는 docs/PLAN.md 5번의 문제 예시를 그대로 사용한다.
// 모듈 로드 시 OpicQuestionSchema로 파싱해, 예시 자체가 스키마에서 벗어나면 즉시 실패하게 한다.
const FEW_SHOT_COMBO: readonly OpicQuestion[] = FewShotSetSchema.parse([
  {
    slot_no: 2,
    function: "description",
    topic: "카페",
    source: "surprise",
    text_en:
      "I'd like to know about a cafe you often go to. Where is it located and what does it look like? Describe it in as much detail as possible.",
    text_ko: "자주 가는 카페에 대해 알고 싶어요. 어디에 있고 어떻게 생겼나요? 최대한 자세히 묘사해 주세요.",
  },
  {
    slot_no: 3,
    function: "habit",
    topic: "카페",
    source: "surprise",
    text_en:
      "What do you usually do at the cafe? Who do you go with and what do you order? Walk me through a typical visit.",
    text_ko: "카페에서 보통 무엇을 하나요? 누구와 함께 가고 무엇을 주문하나요? 평소 방문 과정을 설명해 주세요.",
  },
  {
    slot_no: 4,
    function: "past_experience",
    topic: "카페",
    source: "surprise",
    text_en:
      "Tell me about a memorable experience you had at a cafe. When was it, who were you with, and what made it memorable?",
    text_ko:
      "카페에서 있었던 기억에 남는 경험에 대해 말해 주세요. 언제였고, 누구와 함께였으며, 무엇이 그 경험을 특별하게 만들었나요?",
  },
]) as OpicQuestion[];

const FEW_SHOT_ROLEPLAY: readonly OpicQuestion[] = FewShotSetSchema.parse([
  {
    slot_no: 11,
    function: "roleplay_ask",
    topic: "영화관 예매",
    source: "surprise",
    text_en:
      "I'll give you a situation and act it out. You want to watch a movie this weekend. Call the theater and ask three or four questions to get the information you need.",
    text_ko:
      "상황을 드릴 테니 역할극을 해 주세요. 이번 주말에 영화를 보고 싶습니다. 영화관에 전화해서 필요한 정보를 얻기 위한 질문을 서너 개 해 주세요.",
  },
  {
    slot_no: 12,
    function: "roleplay_solve",
    topic: "영화관 예매",
    source: "surprise",
    text_en:
      "There's a problem. The movie you booked has been canceled. Call your friend, explain the situation, and suggest two or three alternatives.",
    text_ko:
      "문제가 생겼습니다. 예매했던 영화가 취소되었습니다. 친구에게 전화해서 상황을 설명하고 대안을 두세 가지 제안해 주세요.",
  },
  {
    slot_no: 13,
    function: "roleplay_experience",
    topic: "영화관 예매",
    source: "surprise",
    text_en:
      "That's the end of the situation. Have you ever had a plan canceled unexpectedly? Tell me what happened and how you handled it.",
    text_ko: "상황극은 여기까지입니다. 계획이 갑자기 취소된 적이 있나요? 무슨 일이 있었고 어떻게 대처했는지 말해 주세요.",
  },
]) as OpicQuestion[];

const FEW_SHOT_ADVANCED: readonly OpicQuestion[] = FewShotSetSchema.parse([
  {
    slot_no: 14,
    function: "advanced_compare",
    topic: "기술",
    source: "survey",
    text_en:
      "How has technology changed the way people communicate compared to the past? Describe the differences in detail.",
    text_ko: "기술이 사람들의 의사소통 방식을 과거와 비교해 어떻게 바꾸었나요? 그 차이를 자세히 설명해 주세요.",
  },
  {
    slot_no: 15,
    function: "advanced_issue",
    topic: "기술",
    source: "survey",
    text_en:
      "Some people worry about the downsides of smartphones. What are the main concerns, and what do you think can be done about them?",
    text_ko:
      "일부 사람들은 스마트폰의 단점을 걱정합니다. 주요 우려 사항은 무엇이고, 이를 해결하기 위해 어떻게 해야 한다고 생각하나요?",
  },
]) as OpicQuestion[];

const FEW_SHOT_BY_GROUP: Record<TopicAllocationGroup, readonly OpicQuestion[]> = {
  combo1: FEW_SHOT_COMBO,
  combo2: FEW_SHOT_COMBO,
  combo3: FEW_SHOT_COMBO,
  roleplay: FEW_SHOT_ROLEPLAY,
  advanced: FEW_SHOT_ADVANCED,
};

/**
 * 세트 하나(콤보1~3 | 롤플레이 | 어드밴스) 분량의 문항을 생성하도록 지시하는
 * 프롬프트 문자열을 만든다. Claude API를 호출하지 않는 순수 함수 —
 * 같은 입력이면 항상 같은 문자열을 반환한다.
 *
 * 실제 슬롯 순서·유형·개수는 OPIC_BLUEPRINT에서 읽어오고 하드코딩하지 않는다.
 * AI 출력의 slot_no/function은 이 프롬프트로 최대한 정확히 유도할 뿐,
 * 최종 신뢰는 validator.ts의 validateOpicQuestionSet()이 담당한다.
 *
 * @param group 프롬프트를 생성할 세트. combo1~3 | roleplay | advanced.
 * @param topic 이 세트에 배정된 주제 (topicAllocator.allocateTopics 결과 등).
 * @param source 이 세트의 출처 ("survey" | "surprise").
 * @param difficulty Self-Assessment 난이도(1~6). 1~2단계(12문항 모드)는 아직 미지원.
 */
export function buildSetPrompt(
  group: TopicAllocationGroup,
  topic: string,
  source: OpicSource,
  difficulty: OpicDifficultyLevel,
): string {
  assertOpicDifficultyLevel(difficulty, "[buildSetPrompt]");
  assertFifteenQuestionMode(difficulty, "[buildSetPrompt]");

  const trimmedTopic = topic.trim();
  if (trimmedTopic.length === 0) {
    throw new Error("[buildSetPrompt] topic은 빈 문자열일 수 없습니다.");
  }
  if (source !== "survey" && source !== "surprise") {
    throw new Error(`[buildSetPrompt] source는 "survey" 또는 "surprise"여야 합니다. 실제: ${String(source)}`);
  }

  const meta = GROUP_PROMPT_META[group];
  if (!meta) {
    throw new Error(`[buildSetPrompt] '${String(group)}'은 지원하지 않는 그룹입니다.`);
  }

  // blueprint에서 이 그룹의 슬롯을 slotNo 순서 그대로 읽어온다 (순서/유형 하드코딩 금지).
  const slots = OPIC_BLUEPRINT.filter((slot) => slot.group === group);

  const sourceLabel = source === "survey" ? "설문 기반" : "돌발(설문 무관)";

  const slotInstructions = slots
    .map(
      (slot) =>
        `  ${slot.positionInGroup}) ${describeSlotFunctions(slot)}: ${describeSlotInstruction(slot)}`,
    )
    .join("\n");

  const slotNoOptions = slots
    .map(
      (slot) =>
        `  - slot_no ${slot.slotNo}: function은 [${slot.allowedFunctions.join(", ")}] 중 하나`,
    )
    .join("\n");

  const fieldDescriptions = QUESTION_FIELD_ORDER.map(
    (field) => `  - ${field}: ${QUESTION_FIELD_DESCRIPTIONS[field]}`,
  ).join("\n");

  // few-shot은 다른 주제로 만든 참고용 예시이므로, slot_no만 이번 호출의 실제 대상 슬롯에 맞춰 치환한다.
  const fewShot = FEW_SHOT_BY_GROUP[group].map((question, i) => ({
    ...question,
    slot_no: slots[i]?.slotNo ?? question.slot_no,
  }));

  const lines: string[] = [
    "너는 ACTFL OPIc 시험 문항 출제자다.",
    `아래 조건으로 "${meta.label}" 세트 ${slots.length}문항을 작성하라.`,
    "",
    `- 주제(topic): "${trimmedTopic}" (${sourceLabel})`,
    `- 난이도: ${describeDifficulty(difficulty)}`,
    "- 문항 순서와 유형을 반드시 지킬 것 (숫자는 세트 내 순서):",
    slotInstructions,
  ];

  if (meta.extraInstruction) {
    lines.push(`- ${meta.extraInstruction}`);
  }

  lines.push(
    "- 모든 문항은 영어(text_en)로 작성하고, IM3~IH 수준의 자연스러운 인터뷰 구어체를 사용한다.",
    '- 실제 오픽처럼 "최대한 구체적으로 말해달라"는 취지의 요청을 각 문항에 포함한다.',
    "- 설명, 마크다운, 코드펜스 없이 아래 [출력 형식]의 JSON 배열 하나만 출력한다.",
    "",
    `[출력 형식] 길이 ${slots.length}인 JSON 배열. 각 원소는 다음 필드를 갖는다:`,
    fieldDescriptions,
    "  사용 가능한 slot_no / function 조합:",
    slotNoOptions,
    "",
    "[few-shot 예시] (다른 주제로 작성된 참고용 형식 예시이며, 내용을 그대로 복사하지 말 것)",
    JSON.stringify(fewShot, null, 2),
  );

  return lines.join("\n");
}
