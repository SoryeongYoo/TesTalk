import { and, eq, inArray } from "drizzle-orm";
import { addCredits } from "./credits";
import { getDb } from "./db/client";
import { creditOrders, type CreditOrderStatus } from "./db/schema";

/**
 * ⚠️ 서버 전용. 크레딧 구매 주문(credit_orders) 저장소 — 주문 상태를 바꾸는 유일한 경로.
 *
 * 멱등성의 핵심은 claimPaidOrderAndGrant의 조건부 UPDATE다:
 * "status가 pending/failed인 행만 paid로" 바꾸고, 그 UPDATE가 실제로 행을 바꾼 요청만
 * 같은 트랜잭션에서 addCredits를 호출한다. 성공 콜백·웹훅·새로고침이 동시에/중복으로 와도
 * DB가 행 잠금으로 직렬화하므로 paid 전환(=지급)은 정확히 1번이다.
 */

export type CreditOrder = typeof creditOrders.$inferSelect;

export interface NewCreditOrder {
  orderId: string;
  userId: string;
  packageId: string;
  credits: number;
  amount: number;
  provider: string;
}

export async function createOrder(order: NewCreditOrder): Promise<void> {
  await getDb().insert(creditOrders).values({ ...order, status: "pending" });
}

export async function getOrder(orderId: string): Promise<CreditOrder | null> {
  const [row] = await getDb().select().from(creditOrders).where(eq(creditOrders.orderId, orderId));
  return row ?? null;
}

/**
 * 주문을 실패/취소/금액불일치로 표시한다. `from` 상태일 때만 바뀐다 — 이미 paid인 주문을
 * 늦게 온 실패 콜백이 덮어쓰지 못하게 한다.
 * @returns 실제로 상태가 바뀌었는지.
 */
export async function markOrder(
  orderId: string,
  status: Exclude<CreditOrderStatus, "pending" | "paid">,
  reason: string,
  from: readonly CreditOrderStatus[] = ["pending"],
): Promise<boolean> {
  const updated = await getDb()
    .update(creditOrders)
    .set({ status, failureReason: reason.slice(0, 500), updatedAt: new Date() })
    .where(and(eq(creditOrders.orderId, orderId), inArray(creditOrders.status, [...from])))
    .returning({ orderId: creditOrders.orderId });
  return updated.length > 0;
}

/**
 * 승인 확인된 주문을 paid로 전환하고, 전환에 성공한 경우에만 같은 트랜잭션에서 크레딧을 지급한다.
 * 지급 대상(userId)과 수량(credits)은 주문 행의 값만 쓴다 — 호출부 입력이 아니다.
 *
 * @returns granted=false면 이미 paid였거나(중복 콜백/웹훅) 지급 불가 상태 — 지급하지 않았다.
 */
export async function claimPaidOrderAndGrant(
  orderId: string,
  paymentKey: string,
): Promise<{ granted: true; userId: string; credits: number; creditBalance: number } | { granted: false }> {
  return getDb().transaction(async (tx) => {
    const now = new Date();
    const [claimed] = await tx
      .update(creditOrders)
      .set({ status: "paid", paymentKey, paidAt: now, updatedAt: now, failureReason: null })
      .where(and(eq(creditOrders.orderId, orderId), inArray(creditOrders.status, ["pending", "failed"])))
      .returning({ userId: creditOrders.userId, credits: creditOrders.credits });
    if (!claimed) return { granted: false };

    const creditBalance = await addCredits(claimed.userId, claimed.credits, tx);
    return { granted: true, userId: claimed.userId, credits: claimed.credits, creditBalance };
  });
}
