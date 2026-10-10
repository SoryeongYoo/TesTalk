"use server";

import { auth } from "@/auth";
import { getCreditBalance } from "@/lib/server/credits";
import { DailyGenerationLimitError, InsufficientCreditsError } from "@/lib/server/errors";
import type { GenerateTestSetResult } from "@/lib/server/generateTestSet";
import { generateTestSetWithLimit } from "@/lib/server/generateTestSetWithLimit";
import { createGradedExam } from "@/lib/server/gradedExam";
import type { OpicDifficultyLevel } from "@testalk/shared";

/**
 * - "practice": 무료 연습. 하루 DAILY_FREE_GENERATIONS회까지 생성 + 말하기 연습, 피드백은 잠금.
 * - "graded": 채점 응시. 1크레딧 차감 → 생성 → 15문항 피드백 허용. 무료 일일 한도와 무관.
 */
export type ExamMode = "practice" | "graded";

/**
 * 생성 게이트(로그인/일일 한도/크레딧)에 막힌 경우는 예외가 아니라 정상 결과로 돌려준다 —
 * Server Action 경계를 넘으면 에러 클래스가 사라져 클라이언트에서 구분할 수 없기 때문.
 * 그 외 생성 실패(검증 실패 등)는 기존처럼 throw한다.
 */
export type GenerateTestSetActionResult =
  | { status: "ok"; mode: "practice"; result: GenerateTestSetResult; used: number; limit: number }
  | { status: "ok"; mode: "graded"; result: GenerateTestSetResult; examId: string; creditBalance: number }
  | { status: "login_required" }
  /** 무료 한도 소진. creditBalance > 0이면 채점 응시로 안내, 0이면 "크레딧이 필요합니다". */
  | { status: "daily_limit_reached"; limit: number; creditBalance: number }
  | { status: "insufficient_credits" };

/**
 * Server Action 진입점. 인증 확인 + (무료) 일일 생성 제한 또는 (채점) 크레딧 차감을 거친 뒤
 * generateTestSet을 호출한다. 실제 생성 로직은 lib/server/generateTestSet.ts, 게이트/환불은
 * lib/server/generateTestSetWithLimit.ts(무료)와 lib/server/gradedExam.ts(채점)에 있다.
 * ANTHROPIC_API_KEY는 서버 코드에서만 읽힌다.
 *
 * ⚠️ 새 화면/API 라우트에서 생성이 필요해도 generateTestSet을 직접 부르지 말고 반드시
 * 이 진입점을 거치게 한다 — 그래야 비용 게이트를 우회할 수 없다.
 * 게이트 검사는 모두 Claude 호출 전에 끝나므로, 막힌 요청은 API 비용이 0이다.
 */
export async function generateTestSet(
  surveyTopics: string[],
  difficulty: OpicDifficultyLevel,
  mode: ExamMode = "practice",
): Promise<GenerateTestSetActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "login_required" };
  }
  const userId = session.user.id;

  if (mode === "graded") {
    try {
      const { result, examId, creditBalance } = await createGradedExam(userId, surveyTopics, difficulty);
      return { status: "ok", mode: "graded", result, examId, creditBalance };
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        return { status: "insufficient_credits" };
      }
      throw err;
    }
  }

  try {
    const { result, used, limit } = await generateTestSetWithLimit(userId, surveyTopics, difficulty);
    return { status: "ok", mode: "practice", result, used, limit };
  } catch (err) {
    if (err instanceof DailyGenerationLimitError) {
      const creditBalance = await getCreditBalance(userId);
      return { status: "daily_limit_reached", limit: err.limit, creditBalance };
    }
    throw err;
  }
}
