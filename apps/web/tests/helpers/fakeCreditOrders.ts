import type { CreditOrder, NewCreditOrder } from "@/lib/server/creditOrders";
import { addCredits } from "@/lib/server/credits";
import type { CreditOrderStatus } from "@/lib/server/db/schema";

/**
 * lib/server/creditOrders.ts의 메모리 구현 (테스트 전용).
 *
 * 실제 구현의 SQL 조건부 UPDATE 의미를 그대로 흉내 낸다:
 * - markOrder: `from` 상태일 때만 변경
 * - claimPaidOrderAndGrant: pending/failed일 때만 paid로 바꾸고, 바꾼 경우에만 addCredits.
 *   check-and-set을 await 없이 동기적으로 해서, 동시에 들어온 요청 중 하나만 이긴다
 *   (DB의 행 잠금 직렬화에 해당).
 *
 * addCredits는 테스트에서 vi.mock("@/lib/server/credits")로 바꿔 끼운 mock이 호출된다.
 */
const orders = new Map<string, CreditOrder>();

export function resetFakeOrders(): void {
  orders.clear();
}

export function getFakeOrder(orderId: string): CreditOrder | undefined {
  const order = orders.get(orderId);
  return order ? { ...order } : undefined;
}

export function allFakeOrders(): CreditOrder[] {
  return [...orders.values()].map((o) => ({ ...o }));
}

/** 테스트에서 특정 상태의 주문을 직접 심을 때 쓴다. */
export function seedFakeOrder(order: NewCreditOrder, status: CreditOrderStatus = "pending"): void {
  const now = new Date();
  orders.set(order.orderId, {
    ...order,
    status,
    paymentKey: null,
    failureReason: null,
    createdAt: now,
    updatedAt: now,
    paidAt: null,
  });
}

export async function createOrder(order: NewCreditOrder): Promise<void> {
  if (orders.has(order.orderId)) throw new Error(`duplicate order_id ${order.orderId}`);
  seedFakeOrder(order);
}

export async function getOrder(orderId: string): Promise<CreditOrder | null> {
  return getFakeOrder(orderId) ?? null;
}

export async function markOrder(
  orderId: string,
  status: Exclude<CreditOrderStatus, "pending" | "paid">,
  reason: string,
  from: readonly CreditOrderStatus[] = ["pending"],
): Promise<boolean> {
  const order = orders.get(orderId);
  if (!order || !from.includes(order.status)) return false;
  order.status = status;
  order.failureReason = reason;
  order.updatedAt = new Date();
  return true;
}

export async function claimPaidOrderAndGrant(
  orderId: string,
  paymentKey: string,
): Promise<{ granted: true; userId: string; credits: number; creditBalance: number } | { granted: false }> {
  const order = orders.get(orderId);
  if (!order || (order.status !== "pending" && order.status !== "failed")) return { granted: false };
  order.status = "paid";
  order.paymentKey = paymentKey;
  order.paidAt = new Date();
  order.failureReason = null;

  const creditBalance = await addCredits(order.userId, order.credits);
  return { granted: true, userId: order.userId, credits: order.credits, creditBalance };
}
