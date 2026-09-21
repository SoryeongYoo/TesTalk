/**
 * Background Survey 선택 검증 규칙(순수 함수).
 *
 * `survey.ts`가 항목 데이터(SURVEY_CATEGORIES)를 소유하는 것처럼, 이 파일은
 * "선택이 유효한가"를 판단하는 규칙을 소유한다. 화면(apps/web)은 이 함수들의
 * 결과만 읽어서 버튼 활성화/안내 문구/카드 비활성화를 그린다 — 규칙을 화면에
 * 다시 하드코딩하지 않는다.
 *
 * 규칙 요약:
 *  - part1(직업)/part2(학생 여부, 후속 수강 이력 포함)/part3(거주 형태): 각 택1 필수.
 *  - part4(여가)/part5(취미)/part6(운동)/part7(휴가·출장): 각 파트 최소 2개.
 *    part6의 "운동을 전혀 하지 않음"도 다른 옵션과 동일한 일반 옵션이다 — 예외 없음.
 *  - part4~7 선택 합계가 정확히 12개여야 설문을 완료할 수 있다.
 *    · 12개 미만이면 완료 불가 + 부족한 개수를 안내한다.
 *    · 12개에 도달하면 새로 선택하는 것은 막되, 이미 한 선택을 해제하는 것은 항상 허용한다.
 *
 * 설문이 끝나면 `collectSurveyTopicPool()`이 part4~7에서 고른 항목의 label을 모아
 * `allocateTopics()`의 `surveyTopics` 인자 형태(문자열 배열)로 넘긴다 — 설문 label과
 * topic pool 값 사이의 매핑은 이 함수 하나가 소유하고, 화면은 결과만 그대로 전달한다.
 */

import { SURVEY_TOPIC_POOL_CATEGORY_IDS, type SurveyCategory } from "./survey";

/** categoryId(또는 후속 질문 id) -> 선택된 optionId 목록. single 파트는 최대 1개만 담긴다. */
export type SurveySelections = Record<string, string[]>;

/** part4~7 선택 합계가 정확히 이 개수여야 설문을 완료할 수 있다. */
export const SURVEY_POOL_TOTAL_REQUIRED = 12;

const POOL_CATEGORY_ID_SET = new Set<string>(SURVEY_TOPIC_POOL_CATEGORY_IDS);

/** category.id가 part4~7(합계 12개 규칙이 적용되는 파트) 소속인지. */
export function isPoolCategory(categoryId: string): boolean {
  return POOL_CATEGORY_ID_SET.has(categoryId);
}

/** 한 파트가 자체 최소 선택 규칙(minSelect)을 만족하는지. */
export function isCategorySatisfied(
  category: Pick<SurveyCategory, "minSelect">,
  selectedIds: readonly string[],
): boolean {
  return selectedIds.length >= category.minSelect;
}

/** part4~7 전체에서 선택된 총 개수(배타 옵션 포함). "선택: N / 12"에 쓰는 값. */
export function countPoolSelections(
  selections: SurveySelections,
  categories: readonly Pick<SurveyCategory, "id">[],
): number {
  let total = 0;
  for (const category of categories) {
    if (!isPoolCategory(category.id)) continue;
    total += (selections[category.id] ?? []).length;
  }
  return total;
}

/** part4~7 합계가 12개에 도달해, 새 선택은 막고 해제만 허용해야 하는 상태인지. */
export function isPoolCapReached(
  selections: SurveySelections,
  categories: readonly Pick<SurveyCategory, "id">[],
): boolean {
  return countPoolSelections(selections, categories) >= SURVEY_POOL_TOTAL_REQUIRED;
}

/**
 * 한 파트 안에서 옵션을 토글한 결과를 계산한다(순수 함수, 입력을 변형하지 않음).
 * - single: 항상 새로 고른 옵션 하나로 교체.
 * - multi: 이미 선택된 옵션을 다시 누르면 해제(항상 허용). 아직 선택되지 않은 옵션을
 *          고르는 경우, part4~7 소속 파트에서 합계가 이미 12개면 막는다(선택 변화 없음;
 *          해제는 이 제한과 무관하게 항상 허용).
 */
export function toggleSurveyOption(
  currentSelectedIds: readonly string[],
  category: Pick<SurveyCategory, "id" | "selectionType">,
  optionId: string,
  selections: SurveySelections,
  categories: readonly Pick<SurveyCategory, "id">[],
): string[] {
  if (category.selectionType === "single") {
    return [optionId];
  }

  if (currentSelectedIds.includes(optionId)) {
    // 이미 선택된 옵션 해제 — 12개 캡과 무관하게 항상 허용.
    return currentSelectedIds.filter((id) => id !== optionId);
  }

  // 새로 선택하려는 경우: part4~7 소속이면서 합계가 이미 12개면 막는다(선택 변화 없음).
  if (isPoolCategory(category.id) && isPoolCapReached(selections, categories)) {
    return [...currentSelectedIds];
  }

  return [...currentSelectedIds, optionId];
}

/** 설문 완료 가능 여부를 판단하기 위한 part4~7 종합 상태. */
export interface SurveyPoolStatus {
  /** part4~7 선택 합계. */
  poolCount: number;
  /** 완료(12개)까지 남은 개수. 이미 12개 이상이면 0. */
  poolRemaining: number;
  /** 합계가 정확히 12개에 도달했는지. */
  poolReached: boolean;
  /** 최소 선택 개수(2개)를 아직 못 채운 파트의 title 목록. */
  unsatisfiedCategoryTitles: string[];
  /** part4~7 규칙(각 파트 최소 2개 + 합계 정확히 12개)을 모두 만족해 완료 가능한지. */
  canComplete: boolean;
}

/**
 * part4~7 선택 상태를 종합해 완료 가능 여부와 안내에 필요한 정보를 계산한다.
 * 우선순위 규칙: 파트별 최소 개수 미달이 있으면 그 안내가 우선이고, 모든 파트가
 * 자체 최소 개수를 만족했는데도 합계가 12개 미만이면 "N개 더 선택" 안내로 넘어간다.
 */
export function getSurveyPoolStatus(
  selections: SurveySelections,
  categories: readonly Pick<SurveyCategory, "id" | "title" | "minSelect">[],
): SurveyPoolStatus {
  const poolCategories = categories.filter((c) => isPoolCategory(c.id));
  const poolCount = poolCategories.reduce(
    (sum, c) => sum + (selections[c.id] ?? []).length,
    0,
  );
  const unsatisfiedCategoryTitles = poolCategories
    .filter((c) => !isCategorySatisfied(c, selections[c.id] ?? []))
    .map((c) => c.title);
  const poolReached = poolCount >= SURVEY_POOL_TOTAL_REQUIRED;

  return {
    poolCount,
    poolRemaining: Math.max(0, SURVEY_POOL_TOTAL_REQUIRED - poolCount),
    poolReached,
    unsatisfiedCategoryTitles,
    canComplete: poolReached && unsatisfiedCategoryTitles.length === 0,
  };
}

/**
 * part4~7(여가/취미/운동/휴가·출장)에서 선택된 옵션의 label만 모아
 * `allocateTopics()`가 받는 `surveyTopics: readonly string[]` 형태로 변환한다.
 * 설문 화면(apps/web)은 이 결과를 그대로 서버 액션(generateTestSet)에 넘기면 된다 —
 * label 문자열 자체가 topic 값이므로 별도 id ↔ topic 매핑 테이블은 필요 없다.
 */
export function collectSurveyTopicPool(
  selections: SurveySelections,
  categories: readonly Pick<SurveyCategory, "id" | "options">[],
): string[] {
  const topics: string[] = [];
  for (const category of categories) {
    if (!isPoolCategory(category.id)) continue;
    const selectedIds = selections[category.id] ?? [];
    for (const option of category.options) {
      if (selectedIds.includes(option.id)) topics.push(option.label);
    }
  }
  return topics;
}
