import type { OpicDifficultyLevel } from "@testalk/shared";
import { DailyGenerationLimitError } from "./errors";
import { generateTestSet, type GenerateTestSetResult } from "./generateTestSet";
import { refundDailyGeneration, tryConsumeDailyGeneration } from "./generationLimit";

/**
 * generateTestSet()을 일일 생성 제한으로 감싼 얇은 래퍼 (evaluateAnswerWithCredit과 같은 구조).
 *
 * 1) 오늘 횟수가 한도 미만이면 원자적으로 +1 (tryConsumeDailyGeneration) — 한도 초과면
 *    generateTestSet을 아예 호출하지 않는다 (Claude API 비용 0).
 * 2) 카운트 후 생성이 실패하면 사용자 보호를 위해 1을 되돌린다.
 *
 * 인증은 이 함수의 책임이 아니다 — 호출부(Server Action)가 로그인 여부를 확인한 뒤
 * 신뢰 가능한 userId(Cognito sub)만 넘긴다는 전제다.
 */
export async function generateTestSetWithLimit(
  userId: string,
  surveyTopics: readonly string[],
  difficulty: OpicDifficultyLevel,
): Promise<{ result: GenerateTestSetResult; used: number; limit: number }> {
  const consumed = await tryConsumeDailyGeneration(userId);
  if (!consumed.allowed) {
    console.log(`[generationLimit] 한도 초과로 거부 — user=${userId}, limit=${consumed.limit}`);
    throw new DailyGenerationLimitError(consumed.limit);
  }
  console.log(
    `[generationLimit] 생성 허용 — user=${userId}, ${consumed.usageDate} ${consumed.used}/${consumed.limit}`,
  );

  try {
    const result = await generateTestSet(surveyTopics, difficulty);
    return { result, used: consumed.used, limit: consumed.limit };
  } catch (err) {
    await refundDailyGeneration(userId, consumed.usageDate);
    throw err;
  }
}
