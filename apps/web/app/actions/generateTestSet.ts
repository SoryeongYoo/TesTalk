"use server";

import { auth } from "@/auth";
import { DailyGenerationLimitError } from "@/lib/server/errors";
import type { GenerateTestSetResult } from "@/lib/server/generateTestSet";
import { generateTestSetWithLimit } from "@/lib/server/generateTestSetWithLimit";
import type { OpicDifficultyLevel } from "@testalk/shared";

/**
 * 생성 게이트(로그인/일일 한도)에 막힌 경우는 예외가 아니라 정상 결과로 돌려준다 —
 * Server Action 경계를 넘으면 에러 클래스가 사라져 클라이언트에서 구분할 수 없기 때문.
 * 그 외 생성 실패(검증 실패 등)는 기존처럼 throw한다.
 */
export type GenerateTestSetActionResult =
  | { status: "ok"; result: GenerateTestSetResult; used: number; limit: number }
  | { status: "login_required" }
  | { status: "daily_limit_reached"; limit: number };

/**
 * Server Action 진입점. 인증 확인 + 일일 생성 제한을 거친 뒤 generateTestSet을 호출한다.
 * 실제 생성 로직은 lib/server/generateTestSet.ts, 카운트/환불은
 * lib/server/generateTestSetWithLimit.ts에 있다. ANTHROPIC_API_KEY는 서버 코드에서만 읽힌다.
 *
 * ⚠️ 새 화면/API 라우트에서 생성이 필요해도 generateTestSet을 직접 부르지 말고 반드시
 * 이 진입점(또는 generateTestSetWithLimit)을 거치게 한다 — 그래야 비용 게이트를 우회할 수 없다.
 * 게이트 검사는 모두 Claude 호출 전에 끝나므로, 막힌 요청은 API 비용이 0이다.
 */
export async function generateTestSet(
  surveyTopics: string[],
  difficulty: OpicDifficultyLevel,
): Promise<GenerateTestSetActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "login_required" };
  }

  try {
    const { result, used, limit } = await generateTestSetWithLimit(
      session.user.id,
      surveyTopics,
      difficulty,
    );
    return { status: "ok", result, used, limit };
  } catch (err) {
    if (err instanceof DailyGenerationLimitError) {
      return { status: "daily_limit_reached", limit: err.limit };
    }
    throw err;
  }
}
