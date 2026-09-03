/**
 * OPIc(오픽) 모의고사 15문항 blueprint.
 *
 * 시험은 슬롯(1~15번)마다 출제되는 "유형(function)"이 고정되어 있다.
 * AI가 실제로 생성하는 문제는 이 blueprint 순서와 유형을 그대로 따라야 한다.
 *
 * 구성:
 *  - 1번          : 자기소개 (intro)
 *  - 2~4번  (콤보1): 묘사 → 습관/비교 → 과거경험
 *  - 5~7번  (콤보2): 묘사 → 습관/비교 → 과거경험 (동일 패턴, 다른 주제)
 *  - 8~10번 (콤보3): 묘사 → 습관/비교 → 과거경험 (동일 패턴, 다른 주제)
 *  - 11~13번 (롤플레이): 질문하기 → 문제해결 → 관련경험
 *  - 14~15번 (어드밴스): 비교 → 이슈
 */

/** AI가 생성하는 문제가 가질 수 있는 전체 유형(function) 목록. */
export const OPIC_FUNCTIONS = [
  "description",
  "habit",
  "comparison",
  "past_experience",
  "roleplay_ask",
  "roleplay_solve",
  "roleplay_experience",
  "intro",
  "advanced_compare",
  "advanced_issue",
] as const;

export type OpicFunction = (typeof OPIC_FUNCTIONS)[number];

/** 15문항을 구성하는 콤보/섹션 그룹. */
export const OPIC_GROUPS = [
  "intro",
  "combo1",
  "combo2",
  "combo3",
  "roleplay",
  "advanced",
] as const;

export type OpicGroup = (typeof OPIC_GROUPS)[number];

/** blueprint의 한 슬롯(문항 자리) 정의. */
export interface BlueprintSlot {
  /** 1~15 사이의 문항 번호. */
  slotNo: number;
  /** 이 슬롯이 속한 콤보/섹션 그룹. */
  group: OpicGroup;
  /** 그룹 내에서의 순서 (예: 콤보의 1/2/3번째 문항). */
  positionInGroup: number;
  /**
   * 이 슬롯에 허용되는 유형 목록.
   * 콤보의 2번째 문항처럼 "습관" 또는 "비교" 둘 다 나올 수 있는 경우
   * 배열에 두 개 이상의 유형이 들어간다.
   */
  allowedFunctions: readonly OpicFunction[];
  /** 사람이 읽기 위한 한글 라벨. */
  label: string;
}

/** 콤보(2~4, 5~7, 8~10) 하나의 3문항 패턴: 묘사 → 습관/비교 → 과거경험. */
function comboSlots(
  group: OpicGroup,
  startSlotNo: number,
): readonly [BlueprintSlot, BlueprintSlot, BlueprintSlot] {
  return [
    {
      slotNo: startSlotNo,
      group,
      positionInGroup: 1,
      allowedFunctions: ["description"],
      label: "묘사",
    },
    {
      slotNo: startSlotNo + 1,
      group,
      positionInGroup: 2,
      allowedFunctions: ["habit", "comparison"],
      label: "습관/비교",
    },
    {
      slotNo: startSlotNo + 2,
      group,
      positionInGroup: 3,
      allowedFunctions: ["past_experience"],
      label: "과거경험",
    },
  ];
}

/** OPIc 15문항 blueprint. 인덱스 0이 1번 문항, 인덱스 14가 15번 문항. */
export const OPIC_BLUEPRINT: readonly BlueprintSlot[] = [
  {
    slotNo: 1,
    group: "intro",
    positionInGroup: 1,
    allowedFunctions: ["intro"],
    label: "자기소개",
  },
  ...comboSlots("combo1", 2),
  ...comboSlots("combo2", 5),
  ...comboSlots("combo3", 8),
  {
    slotNo: 11,
    group: "roleplay",
    positionInGroup: 1,
    allowedFunctions: ["roleplay_ask"],
    label: "질문하기",
  },
  {
    slotNo: 12,
    group: "roleplay",
    positionInGroup: 2,
    allowedFunctions: ["roleplay_solve"],
    label: "문제해결",
  },
  {
    slotNo: 13,
    group: "roleplay",
    positionInGroup: 3,
    allowedFunctions: ["roleplay_experience"],
    label: "관련경험",
  },
  {
    slotNo: 14,
    group: "advanced",
    positionInGroup: 1,
    allowedFunctions: ["advanced_compare"],
    label: "비교",
  },
  {
    slotNo: 15,
    group: "advanced",
    positionInGroup: 2,
    allowedFunctions: ["advanced_issue"],
    label: "이슈",
  },
];

/**
 * 세트 내 모든 문항이 같은 topic을 다뤄야 하는 그룹.
 * 콤보1~3(2~4, 5~7, 8~10)과 롤플레이(11~13)는 하나의 주제를 세 문항에 걸쳐 묻는다.
 * intro(1번)와 advanced(14~15번)는 각 문항이 독립 주제를 가질 수 있어 제외한다.
 */
export const TOPIC_CONSISTENT_GROUPS: readonly OpicGroup[] = [
  "combo1",
  "combo2",
  "combo3",
  "roleplay",
];

/**
 * Topic Allocator가 topic(과 source)을 배정해야 하는 그룹.
 * intro(1번)는 "자기소개"로 topic 없이 고정 진행되므로 제외한다.
 * (참고: docs/PLAN.md 4-2 Topic Allocator)
 */
export const TOPIC_ALLOCATION_GROUPS = [
  "combo1",
  "combo2",
  "combo3",
  "roleplay",
  "advanced",
] as const;

export type TopicAllocationGroup = (typeof TOPIC_ALLOCATION_GROUPS)[number];

/** 문항 번호(1~15)로 blueprint 슬롯을 찾는다. */
export function getBlueprintSlot(slotNo: number): BlueprintSlot | undefined {
  return OPIC_BLUEPRINT.find((slot) => slot.slotNo === slotNo);
}

export const OPIC_QUESTION_COUNT = OPIC_BLUEPRINT.length;
