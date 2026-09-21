import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "./db/client";
import { credits } from "./db/schema";

/**
 * ⚠️ 서버 전용. 크레딧 잔액을 읽고/쓰는 유일한 경로 — 클라이언트는 절대
 * balance를 직접 조작할 수 없고, 여기 있는 함수를 거쳐야만 한다.
 *
 * addCredits()는 이 파일에서만 export되고 어떤 Server Action도 감싸지 않는다.
 * 즉 브라우저에서 호출할 방법이 없다 — 관리자 스크립트(scripts/add-credits.ts)나
 * 나중에 붙을 토스 결제 성공 콜백(서버 라우트)에서만 호출한다.
 */

/** 신규 가입자에게 지급하는 무료 크레딧 개수. 정책이 바뀌면 이 값만 수정하면 된다. */
export const DEFAULT_SIGNUP_CREDITS = 3;

export async function getCreditBalance(userId: string): Promise<number> {
  const db = getDb();
  const [row] = await db.select({ balance: credits.balance }).from(credits).where(eq(credits.userId, userId));
  return row?.balance ?? 0;
}

/**
 * 잔액이 1 이상일 때만 원자적으로 1을 차감한다.
 * "읽고 → 빼고 → 쓰는" 3단계 대신, 조건(balance >= 1)을 WHERE절에 넣은 UPDATE 한 번으로
 * 처리한다 — 동시에 두 요청이 들어와도 DB가 각 UPDATE를 직렬화하므로 이중 차감이나
 * 음수 잔액이 생기지 않는다.
 *
 * @returns 차감 성공 여부. false면 잔액 부족(다른 동시 요청이 먼저 차감해 부족해진 경우 포함).
 */
export async function deductCredit(userId: string): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(credits)
    .set({ balance: sql`${credits.balance} - 1`, updatedAt: new Date() })
    .where(and(eq(credits.userId, userId), gte(credits.balance, 1)))
    .returning({ balance: credits.balance });
  return updated.length > 0;
}

/** 차감 후 AI 호출이 실패했을 때 사용자 보호를 위해 크레딧 1을 되돌린다. */
export async function refundCredit(userId: string): Promise<void> {
  const db = getDb();
  await db
    .update(credits)
    .set({ balance: sql`${credits.balance} + 1`, updatedAt: new Date() })
    .where(eq(credits.userId, userId));
}

/**
 * 크레딧을 충전한다 — 결제 없이 잔액을 올리는 유일한 함수.
 * 지금은 관리자 스크립트(pnpm add-credits)가 호출하고, 나중에 토스 결제 성공
 * 콜백이 이 함수를 그대로 대체 호출하도록 설계했다 (충전 로직 자체는 바뀌지 않는다).
 */
export async function addCredits(userId: string, amount: number): Promise<number> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`[addCredits] amount는 양의 정수여야 합니다: ${amount}`);
  }

  const db = getDb();
  const updated = await db
    .update(credits)
    .set({ balance: sql`${credits.balance} + ${amount}`, updatedAt: new Date() })
    .where(eq(credits.userId, userId))
    .returning({ balance: credits.balance });

  if (updated.length === 0) {
    throw new Error(
      `[addCredits] credits 행이 없습니다 (user_id=${userId}). 최소 1회 로그인 이력이 있는 사용자인지 확인하세요.`,
    );
  }
  return updated[0]!.balance;
}
