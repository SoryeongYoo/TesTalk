import { randomUUID } from "node:crypto";
import { findCreditPackage } from "@testalk/shared";
import { claimPaidOrderAndGrant, createOrder, getOrder, markOrder, type CreditOrder } from "./creditOrders";
import { getPaymentProvider, type PaymentProvider, type ProviderPayment } from "./payments";

/**
 * ⚠️ 서버 전용. 크레딧 구매의 유일한 경로 (provider와 무관한 주문/검증/지급 로직).
 *
 * 흐름:
 *  1) startPurchase: packageId → 서버가 패키지 표에서 금액/크레딧 결정 → 주문(pending) 저장.
 *     - redirect(토스): 결제창 파라미터를 돌려주고 끝. 지급은 3)에서.
 *     - instant(stub): 곧바로 confirmOrderPayment.
 *  2) 사용자가 토스 결제창에서 결제 → successUrl(/api/payments/toss/success)로 paymentKey/orderId/amount.
 *  3) confirmOrderPayment: 금액 검증 → 서버에서 토스 승인 API → 승인 응답 재검증 → 멱등 지급.
 *  4) handleTossWebhook: 웹훅 본문은 믿지 않고 paymentKey로 토스에 재조회한 결과로만 상태 갱신/지급.
 *
 * 보안 불변식:
 *  - 지급 대상(userId)과 수량은 주문 행의 값(주문 생성 시 세션에서 정함)만 쓴다.
 *  - 금액은 항상 findCreditPackage(order.packageId).priceKrw와 비교한다.
 *  - 지급은 claimPaidOrderAndGrant의 조건부 UPDATE를 통과한 1회뿐이다.
 */

export type StartPurchaseResult =
  | { status: "checkout"; orderId: string; amountKrw: number; orderName: string; clientKey: string }
  | { status: "ok"; credits: number; creditBalance: number }
  | { status: "already_paid" }
  | { status: "invalid_package" }
  | { status: "payment_unavailable" }
  | { status: "payment_failed"; reason: string }
  | { status: "amount_mismatch" };

export async function startPurchase(userId: string, packageId: unknown): Promise<StartPurchaseResult> {
  const pkg = findCreditPackage(packageId);
  if (!pkg) {
    console.warn(`[purchaseCredits] 알 수 없는 packageId 거부 — user=${userId}, packageId=${String(packageId)}`);
    return { status: "invalid_package" };
  }

  const provider = getPaymentProvider();
  if (!provider) {
    return { status: "payment_unavailable" };
  }

  const orderId = randomUUID();
  const orderName = `TesTalk 크레딧 ${pkg.credits}개`;
  await createOrder({
    orderId,
    userId,
    packageId: pkg.id,
    credits: pkg.credits,
    amount: pkg.priceKrw,
    provider: provider.name,
  });
  console.log(`[purchaseCredits] 주문 생성 — provider=${provider.name}, user=${userId}, order=${orderId}, package=${pkg.id}`);

  if (provider.checkout === "redirect") {
    return { status: "checkout", orderId, amountKrw: pkg.priceKrw, orderName, clientKey: provider.clientKey ?? "" };
  }

  // instant(stub): 결제창 없이 바로 승인/지급까지.
  const confirmed = await confirmOrderPayment(
    { paymentKey: `stub_${randomUUID()}`, orderId, amount: pkg.priceKrw },
    provider,
  );
  switch (confirmed.status) {
    case "paid":
      return { status: "ok", credits: confirmed.credits, creditBalance: confirmed.creditBalance };
    case "already_paid":
      return { status: "already_paid" };
    case "amount_mismatch":
      return { status: "amount_mismatch" };
    default:
      return { status: "payment_failed", reason: confirmed.status };
  }
}

export type ConfirmOrderResult =
  | { status: "paid"; credits: number; creditBalance: number }
  | { status: "already_paid" }
  | { status: "amount_mismatch" }
  | { status: "order_not_found" }
  | { status: "payment_unavailable" }
  | { status: "failed"; code: string; message: string };

/**
 * successUrl 콜백(또는 stub 즉시 승인)에서 호출. 같은 주문으로 여러 번 와도 지급은 1회다.
 * 세션이 없어도 안전하다 — 지급 대상은 주문 행의 userId이고, 토스 승인을 통과해야만 지급된다.
 */
export async function confirmOrderPayment(
  params: { paymentKey: string; orderId: string; amount: number },
  provider: PaymentProvider | null = getPaymentProvider(),
): Promise<ConfirmOrderResult> {
  const order = await getOrder(params.orderId);
  if (!order) return { status: "order_not_found" };
  if (order.status === "paid") return { status: "already_paid" }; // 새로고침/중복 콜백 — 승인 API도 다시 안 부른다.
  if (order.status === "amount_mismatch") return { status: "amount_mismatch" };

  const expected = expectedAmount(order);
  if (expected === null || params.amount !== expected) {
    // 결제창 이후 클라이언트가 금액을 조작한 경우 — 승인 요청 자체를 하지 않으므로 과금도 없다.
    // 주문 상태는 바꾸지 않는다: orderId만 아는 제3자가 잘못된 금액으로 콜백을 보내 남의 정상 결제를
    // 영구히 막는 것을 방지한다. 거부 사실은 로그로 남긴다.
    console.warn(`[purchaseCredits] 콜백 금액 불일치 거부 — order=${order.orderId}, got=${params.amount}, expected=${expected}`);
    return { status: "amount_mismatch" };
  }

  if (!provider) return { status: "payment_unavailable" };

  let confirmed = await provider.confirm({ paymentKey: params.paymentKey, orderId: order.orderId, amountKrw: expected });
  if (!confirmed.ok) {
    // 동시 요청이 먼저 승인했을 수 있다(ALREADY_PROCESSED_PAYMENT 등) — PG에 실제 상태를 다시 묻는다.
    const current = await provider.getPayment(params.paymentKey);
    if (!current.ok || current.payment.status !== "DONE") {
      await markOrder(order.orderId, "failed", `${confirmed.code}: ${confirmed.message}`);
      console.warn(`[purchaseCredits] 승인 실패 — order=${order.orderId}, code=${confirmed.code}`);
      return { status: "failed", code: confirmed.code, message: confirmed.message };
    }
    confirmed = current;
  }

  return grantIfPaymentValid(order, confirmed.payment);
}

/**
 * PG가 확인해준 결제(payment)가 이 주문과 정확히 맞을 때만 멱등 지급한다.
 * 금액/주문번호/상태 중 하나라도 다르면 지급하지 않고 amount_mismatch로 기록한다.
 */
async function grantIfPaymentValid(order: CreditOrder, payment: ProviderPayment): Promise<ConfirmOrderResult> {
  const expected = expectedAmount(order);
  if (payment.orderId !== order.orderId || payment.status !== "DONE" || payment.totalAmount !== expected) {
    const reason =
      `승인 응답 불일치 — orderId=${payment.orderId}, status=${payment.status}, ` +
      `amount=${payment.totalAmount}, expected=${expected}, paymentKey=${payment.paymentKey}`;
    await markOrder(order.orderId, "amount_mismatch", reason, ["pending", "failed"]);
    // ⚠️ 이미 결제된 돈이 있다면 수동 환불 대상 — failure_reason에 paymentKey를 남긴다.
    console.error(`[purchaseCredits] ${reason}`);
    return { status: "amount_mismatch" };
  }

  const claimed = await claimPaidOrderAndGrant(order.orderId, payment.paymentKey);
  if (!claimed.granted) {
    return { status: "already_paid" };
  }
  console.log(
    `[purchaseCredits] 지급 완료 — user=${claimed.userId}, order=${order.orderId}, +${claimed.credits}, balance=${claimed.creditBalance}`,
  );
  return { status: "paid", credits: claimed.credits, creditBalance: claimed.creditBalance };
}

/** 주문의 패키지 가격(서버 기준). 주문 금액과 패키지 가격이 어긋나면(가격 변경 등) null — 지급하지 않는다. */
function expectedAmount(order: CreditOrder): number | null {
  const pkg = findCreditPackage(order.packageId);
  if (!pkg || pkg.priceKrw !== order.amount || pkg.credits !== order.credits) return null;
  return pkg.priceKrw;
}

/** failUrl 콜백 — 본인 주문만 pending → failed. 지급은 없다. */
export async function failOrder(userId: string, orderId: string, code: string, message: string): Promise<void> {
  const order = await getOrder(orderId);
  if (!order || order.userId !== userId) return;
  await markOrder(orderId, "failed", `${code}: ${message}`);
}

const CANCELED_STATUSES = new Set(["CANCELED", "PARTIAL_CANCELED", "ABORTED", "EXPIRED"]);

export type WebhookResult = "granted" | "already_paid" | "ignored" | "marked_canceled" | "rejected";

/**
 * 토스 PAYMENT_STATUS_CHANGED 웹훅 처리.
 *
 * 출처 검증: 결제 상태 웹훅에는 서명 헤더가 없으므로 본문(status/금액)을 믿지 않는다.
 * 본문에서 paymentKey만 꺼내 시크릿 키로 토스 조회 API를 호출하고, 그 응답(=토스가 보증하는 값)으로만
 * 판단한다. 위조된 웹훅은 토스 조회에 실패하거나 실제 상태로 덮어써진다.
 */
export async function handleTossWebhook(body: unknown): Promise<WebhookResult> {
  const event = (body ?? {}) as { eventType?: unknown; data?: { paymentKey?: unknown } };
  if (event.eventType !== "PAYMENT_STATUS_CHANGED") return "ignored";
  const paymentKey = event.data?.paymentKey;
  if (typeof paymentKey !== "string" || paymentKey.length === 0) return "rejected";

  const provider = getPaymentProvider();
  if (!provider || provider.name !== "toss") return "ignored";

  const fetched = await provider.getPayment(paymentKey);
  if (!fetched.ok) {
    console.warn(`[purchaseCredits:webhook] 토스 조회 실패 — paymentKey=${paymentKey}, code=${fetched.code}`);
    return "rejected";
  }
  const payment = fetched.payment;
  const order = await getOrder(payment.orderId);
  if (!order) return "ignored";

  if (payment.status === "DONE") {
    if (order.status === "paid") return "already_paid";
    const result = await grantIfPaymentValid(order, payment);
    return result.status === "paid" ? "granted" : result.status === "already_paid" ? "already_paid" : "rejected";
  }

  if (CANCELED_STATUSES.has(payment.status)) {
    if (order.status === "paid") {
      // 지급 후 결제 취소(환불) — 크레딧 회수는 정책 결정이 필요해 자동으로 하지 않는다.
      console.warn(`[purchaseCredits:webhook] 지급 완료 주문의 결제 취소 — order=${order.orderId}, status=${payment.status} (수동 확인 필요)`);
      return "ignored";
    }
    const changed = await markOrder(order.orderId, "canceled", `토스 상태 ${payment.status}`, ["pending", "failed"]);
    return changed ? "marked_canceled" : "ignored";
  }

  return "ignored"; // READY, IN_PROGRESS, WAITING_FOR_DEPOSIT 등
}
