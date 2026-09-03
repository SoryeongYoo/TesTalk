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
