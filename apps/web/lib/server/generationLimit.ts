import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "./db/client";
import { dailyGenerationUsage } from "./db/schema";

/**
 * ⚠️ 서버 전용. 문제 생성 일일 제한 카운터를 읽고/쓰는 유일한 경로.
 * 크레딧(credits.ts)과 같은 원칙 — 조건을 WHERE절에 넣은 단일 쿼리로 처리해
 * 동시 요청에도 카운트가 꼬이지 않게 한다.
 */

/** 환경변수 DAILY_FREE_GENERATIONS가 없거나 잘못됐을 때 쓰는 기본값. */
export const DEFAULT_DAILY_FREE_GENERATIONS = 2;

/**
 * 로그인 사용자가 하루(KST)에 무료로 생성할 수 있는 시험 세트 수.
 * 환경변수 DAILY_FREE_GENERATIONS(0 이상 정수)로 재배포 없이 조정한다.
 */
export function getDailyFreeGenerations(): number {
  const raw = process.env.DAILY_FREE_GENERATIONS;
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_DAILY_FREE_GENERATIONS;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    console.warn(
      `[generationLimit] DAILY_FREE_GENERATIONS 값이 잘못됐습니다 ("${raw}"). ` +
        `기본값 ${DEFAULT_DAILY_FREE_GENERATIONS}을 사용합니다.`,
    );
    return DEFAULT_DAILY_FREE_GENERATIONS;
  }
  return parsed;
}

/**
 * KST 기준 오늘 날짜. 앱 서버(Amplify Lambda 등)의 시간대 설정에 의존하지 않도록
 * DB에서 계산한다 — 자정(KST)이 지나면 새 날짜 행이 생기므로 리셋 작업이 필요 없다.
 */
const KST_TODAY = sql`(now() AT TIME ZONE 'Asia/Seoul')::date`;

export type ConsumeGenerationResult =
  | { allowed: true; used: number; limit: number; usageDate: string }
  | { allowed: false; limit: number };

/**
 * 오늘 생성 횟수가 한도 미만일 때만 원자적으로 1을 올린다.
 *
 * INSERT ... ON CONFLICT DO UPDATE ... WHERE count < limit 한 문장으로 처리한다:
 * - 오늘 첫 생성이면 count=1 행을 새로 만든다.
 * - 이미 행이 있으면 count < limit일 때만 +1 한다. 한도에 도달했으면 UPDATE가 일어나지
 *   않아 RETURNING이 빈 배열이 된다.
 * 같은 (user_id, usage_date)에 대한 동시 요청은 DB가 행 잠금으로 직렬화하므로
 * 한도를 넘겨 카운트되는 일이 없다.
 */
export async function tryConsumeDailyGeneration(userId: string): Promise<ConsumeGenerationResult> {
  const limit = getDailyFreeGenerations();
  if (limit <= 0) {
    // 한도 0이면 INSERT 경로(count=1)로도 통과시키면 안 된다.
    return { allowed: false, limit };
  }

  const db = getDb();
  const updated = await db
    .insert(dailyGenerationUsage)
    .values({ userId, usageDate: KST_TODAY, count: 1 })
    .onConflictDoUpdate({
      target: [dailyGenerationUsage.userId, dailyGenerationUsage.usageDate],
      set: { count: sql`${dailyGenerationUsage.count} + 1`, updatedAt: new Date() },
      setWhere: sql`${dailyGenerationUsage.count} < ${limit}`,
    })
    .returning({ count: dailyGenerationUsage.count, usageDate: dailyGenerationUsage.usageDate });

  const row = updated[0];
  if (!row) {
    return { allowed: false, limit };
  }
  return { allowed: true, used: row.count, limit, usageDate: row.usageDate };
}

/**
 * 카운트를 올린 뒤 생성이 실패했을 때 사용자 보호를 위해 1을 되돌린다.
 * 자정 직전에 시작해 자정 이후 실패한 경우 새 날짜를 깎지 않도록, 카운트를 올린
 * 그 날짜(usageDate)를 그대로 받아 되돌린다.
 */
export async function refundDailyGeneration(userId: string, usageDate: string): Promise<void> {
  const db = getDb();
  await db
    .update(dailyGenerationUsage)
    .set({ count: sql`${dailyGenerationUsage.count} - 1`, updatedAt: new Date() })
    .where(
      and(
        eq(dailyGenerationUsage.userId, userId),
        eq(dailyGenerationUsage.usageDate, usageDate),
        gt(dailyGenerationUsage.count, 0),
      ),
    );
}
