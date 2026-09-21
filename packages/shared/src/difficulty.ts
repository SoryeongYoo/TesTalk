/**
 * Self-Assessment 난이도(1~6단계). (참고: docs/PLAN.md 2-1)
 * 1~2단계(12문항 모드, 어드밴스 없음)는 blueprint에 아직 구현되어 있지 않다.
 */
export type OpicDifficultyLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** difficulty가 1~6 사이의 정수인지 검사한다. 아니면 에러를 던진다. */
export function assertOpicDifficultyLevel(
  difficulty: number,
  context: string,
): asserts difficulty is OpicDifficultyLevel {
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 6) {
    throw new Error(
      `${context} difficulty는 1~6 사이의 정수여야 합니다. 실제: ${difficulty}`,
    );
  }
}

/**
 * 15문항(난이도 3~6) blueprint 기준으로만 동작하는 기능에서 호출한다.
 * 12문항 모드(난이도 1~2)는 아직 미구현이므로 명확한 에러로 거부한다.
 */
export function assertFifteenQuestionMode(
  difficulty: OpicDifficultyLevel,
  context: string,
): void {
  if (difficulty <= 2) {
    throw new Error(
      `${context} 난이도 1~2단계(12문항 모드, 어드밴스 없음)는 아직 지원하지 않습니다. ` +
        `(참고: docs/PLAN.md 2-4) 실제: ${difficulty}`,
    );
  }
}

/** Self-Assessment 난이도 카드 하나에 필요한 정보. */
export interface OpicDifficultyLevelInfo {
  level: OpicDifficultyLevel;
  /** 카드에 노출할 짧은 "할 수 있는 것" 설명. */
  description: string;
  /**
   * 지금 실제로 선택 가능한지. false면 blueprint가 아직 이 난이도(1~2단계, 12문항
   * 모드)를 지원하지 않는다는 뜻 — 화면은 이 값으로 카드를 비활성 처리하고
   * "준비 중"을 안내한다 (참고: docs/PLAN.md 2-4, `assertFifteenQuestionMode`).
   */
  supported: boolean;
}

/**
 * Self-Assessment 1~6단계 카드 데이터. 화면(apps/web)은 이 배열을 그대로 렌더링만
 * 하고, 단계 번호·설명·지원 여부를 자체적으로 다시 정의하지 않는다.
 */
export const OPIC_DIFFICULTY_LEVELS: readonly OpicDifficultyLevelInfo[] = [
  { level: 1, description: "간단한 단어로 겨우 답할 수 있어요.", supported: false },
  { level: 2, description: "쉬운 문장으로 기본적인 정보를 주고받을 수 있어요.", supported: false },
  { level: 3, description: "일상 주제를 문장으로 말할 수 있어요.", supported: true },
  { level: 4, description: "일상 주제를 문단으로 자신 있게 말할 수 있어요.", supported: true },
  { level: 5, description: "다양한 주제를 논리적으로 설명할 수 있어요.", supported: true },
  { level: 6, description: "복잡한 주제도 유창하고 정교하게 표현할 수 있어요.", supported: true },
];
