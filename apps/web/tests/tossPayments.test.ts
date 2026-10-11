import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfirmRequest, PaymentProvider, ProviderPayment, ProviderPaymentResult } from "@/lib/server/payments";

/**
 * 토스 결제 흐름(주문 → 승인 → 지급, 웹훅)의 멱등성/금액 검증/출처 검증 테스트.
 *
 * - 주문 저장소: 메모리 fake (조건부 상태 전환 의미는 실제 SQL과 같다).
 * - addCredits: mock — 호출 횟수 = 실제 지급 횟수.
 * - 토스 API: fake provider. paymentKey별 "토스 서버 상태"를 들고 있어, 같은 결제의 재승인은
 *   ALREADY_PROCESSED_PAYMENT로 거절하고 조회는 저장된 상태를 돌려준다.
 */

const USER = "buyer-sub";
const OTHER_USER = "other-sub";

const addCreditsMock = vi.fn(async (_userId: string, amount: number) => 100 + amount);
vi.mock("@/lib/server/credits", () => ({
  addCredits: (userId: string, amount: number) => addCreditsMock(userId, amount),
}));
vi.mock("@/lib/server/creditOrders", () => import("./helpers/fakeCreditOrders"));

/** 토스 서버가 기억하는 결제 상태 (paymentKey → payment). */
const tossState = new Map<string, ProviderPayment>();
/** 다음 confirm 응답을 강제로 바꾸고 싶을 때 (금액/주문번호 위조, 승인 실패 시뮬레이션). */
let nextConfirmOverride: ((req: ConfirmRequest) => ProviderPaymentResult) | null = null;

const fakeToss = {
  name: "toss" as const,
  checkout: "redirect" as const,
  clientKey: "test_ck_fake",
  confirm: vi.fn(async (req: ConfirmRequest): Promise<ProviderPaymentResult> => {
    if (nextConfirmOverride) {
      const result = nextConfirmOverride(req);
      nextConfirmOverride = null;
      if (result.ok) tossState.set(req.paymentKey, result.payment);
      return result;
    }
    if (tossState.get(req.paymentKey)?.status === "DONE") {
      return { ok: false, code: "ALREADY_PROCESSED_PAYMENT", message: "이미 처리된 결제 입니다." };
    }
    const payment = { paymentKey: req.paymentKey, orderId: req.orderId, status: "DONE", totalAmount: req.amountKrw };
    tossState.set(req.paymentKey, payment);
    return { ok: true, payment };
  }),
  getPayment: vi.fn(async (paymentKey: string): Promise<ProviderPaymentResult> => {
    const payment = tossState.get(paymentKey);
    return payment ? { ok: true, payment } : { ok: false, code: "NOT_FOUND_PAYMENT", message: "존재하지 않는 결제" };
  }),
} satisfies PaymentProvider;

vi.mock("@/lib/server/payments", () => ({
  getPaymentProvider: () => fakeToss,
  isTestGrantAllowed: () => false,
}));

import { confirmOrderPayment, failOrder, handleTossWebhook, startPurchase } from "@/lib/server/purchaseCredits";
import { getFakeOrder, resetFakeOrders } from "./helpers/fakeCreditOrders";

/** 주문을 만들고(서버) orderId를 돌려준다 — 결제창 직전 상태. */
async function createPendingOrder(packageId = "pack10", userId = USER): Promise<string> {
  const result = await startPurchase(userId, packageId);
  if (result.status !== "checkout") throw new Error(`unexpected ${result.status}`);
  return result.orderId;
}

function webhook(paymentKey: string, bodyOverrides: Record<string, unknown> = {}) {
  return {
    eventType: "PAYMENT_STATUS_CHANGED",
    createdAt: new Date().toISOString(),
    data: { paymentKey, status: "DONE", totalAmount: 999999, ...bodyOverrides },
  };
}

beforeEach(() => {
  resetFakeOrders();
  tossState.clear();
  nextConfirmOverride = null;
  addCreditsMock.mockClear();
  fakeToss.confirm.mockClear();
  fakeToss.getPayment.mockClear();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("주문 생성", () => {
  it("결제창 파라미터만 돌려주고 지급하지 않는다 — 금액·대상은 서버가 결정", async () => {
    const result = await startPurchase(USER, "pack10");
    expect(result).toMatchObject({ status: "checkout", amountKrw: 8900, clientKey: "test_ck_fake" });
    const orderId = (result as { orderId: string }).orderId;
    expect(getFakeOrder(orderId)).toMatchObject({ userId: USER, credits: 10, amount: 8900, status: "pending" });
    expect(fakeToss.confirm).not.toHaveBeenCalled();
    expect(addCreditsMock).not.toHaveBeenCalled();
  });
});

describe("정상 승인", () => {
  it("successUrl 콜백 → 서버 승인 → 주문 유저에게 1회 지급", async () => {
    const orderId = await createPendingOrder();
    const result = await confirmOrderPayment({ paymentKey: "pk_1", orderId, amount: 8900 });

    expect(result).toMatchObject({ status: "paid", credits: 10 });
    expect(fakeToss.confirm).toHaveBeenCalledExactlyOnceWith({ paymentKey: "pk_1", orderId, amountKrw: 8900 });
    expect(addCreditsMock).toHaveBeenCalledExactlyOnceWith(USER, 10);
    expect(getFakeOrder(orderId)).toMatchObject({ status: "paid", paymentKey: "pk_1" });
  });
});

describe("멱등성 — 같은 주문은 1회만 지급", () => {
  it("콜백 2번(새로고침) → 두 번째는 already_paid, 승인 API도 다시 안 부름", async () => {
    const orderId = await createPendingOrder();
    await confirmOrderPayment({ paymentKey: "pk_1", orderId, amount: 8900 });
    const second = await confirmOrderPayment({ paymentKey: "pk_1", orderId, amount: 8900 });

    expect(second).toEqual({ status: "already_paid" });
    expect(fakeToss.confirm).toHaveBeenCalledOnce();
    expect(addCreditsMock).toHaveBeenCalledOnce();
  });

  it("콜백 2개가 동시에 도착 → 지급 1회", async () => {
    const orderId = await createPendingOrder();
    const results = await Promise.all([
      confirmOrderPayment({ paymentKey: "pk_1", orderId, amount: 8900 }),
      confirmOrderPayment({ paymentKey: "pk_1", orderId, amount: 8900 }),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual(["already_paid", "paid"]);
    expect(addCreditsMock).toHaveBeenCalledOnce();
  });

  it("콜백으로 지급된 뒤 웹훅이 2번 와도 추가 지급 없음", async () => {
    const orderId = await createPendingOrder();
    await confirmOrderPayment({ paymentKey: "pk_1", orderId, amount: 8900 });

    expect(await handleTossWebhook(webhook("pk_1"))).toBe("already_paid");
    expect(await handleTossWebhook(webhook("pk_1"))).toBe("already_paid");
    expect(addCreditsMock).toHaveBeenCalledOnce();
  });

  it("웹훅이 콜백보다 먼저 와서 지급 → 늦게 온 콜백은 already_paid", async () => {
    const orderId = await createPendingOrder();
    // 사용자가 결제를 마쳤지만(토스 상태 DONE) successUrl 리다이렉트 전에 브라우저를 닫은 상황.
    tossState.set("pk_1", { paymentKey: "pk_1", orderId, status: "DONE", totalAmount: 8900 });

    expect(await handleTossWebhook(webhook("pk_1"))).toBe("granted");
    expect(await handleTossWebhook(webhook("pk_1"))).toBe("already_paid");
    expect(await confirmOrderPayment({ paymentKey: "pk_1", orderId, amount: 8900 })).toEqual({ status: "already_paid" });
    expect(addCreditsMock).toHaveBeenCalledExactlyOnceWith(USER, 10);
  });

  it("웹훅 2개가 동시에 도착 → 지급 1회", async () => {
    const orderId = await createPendingOrder();
    tossState.set("pk_1", { paymentKey: "pk_1", orderId, status: "DONE", totalAmount: 8900 });

    const results = await Promise.all([handleTossWebhook(webhook("pk_1")), handleTossWebhook(webhook("pk_1"))]);
    expect(results.sort()).toEqual(["already_paid", "granted"]);
    expect(addCreditsMock).toHaveBeenCalledOnce();
  });
});

describe("금액 검증", () => {
  it("콜백 amount 위조(100원) → 승인 요청 안 함, 지급 없음, 주문은 그대로 pending", async () => {
    const orderId = await createPendingOrder();
    const result = await confirmOrderPayment({ paymentKey: "pk_1", orderId, amount: 100 });

    expect(result).toEqual({ status: "amount_mismatch" });
    expect(fakeToss.confirm).not.toHaveBeenCalled();
    expect(addCreditsMock).not.toHaveBeenCalled();
    // 제3자가 잘못된 금액 콜백으로 남의 주문을 막지 못하도록 상태는 유지 → 정상 콜백은 여전히 지급된다.
    expect(getFakeOrder(orderId)?.status).toBe("pending");
    expect(await confirmOrderPayment({ paymentKey: "pk_1", orderId, amount: 8900 })).toMatchObject({ status: "paid" });
  });

  it("토스 승인 응답 금액 ≠ 패키지 가격 → 지급 거부 + amount_mismatch 기록", async () => {
    const orderId = await createPendingOrder();
    nextConfirmOverride = (req) => ({
      ok: true,
      payment: { paymentKey: req.paymentKey, orderId: req.orderId, status: "DONE", totalAmount: 100 },
    });

    expect(await confirmOrderPayment({ paymentKey: "pk_1", orderId, amount: 8900 })).toEqual({ status: "amount_mismatch" });
    expect(addCreditsMock).not.toHaveBeenCalled();
    expect(getFakeOrder(orderId)).toMatchObject({ status: "amount_mismatch" });
    expect(getFakeOrder(orderId)?.failureReason).toContain("pk_1"); // 수동 환불용 paymentKey 기록

    // 이후 웹훅/콜백이 와도 지급되지 않는다.
    expect(await handleTossWebhook(webhook("pk_1"))).toBe("rejected");
    expect(await confirmOrderPayment({ paymentKey: "pk_1", orderId, amount: 8900 })).toEqual({ status: "amount_mismatch" });
    expect(addCreditsMock).not.toHaveBeenCalled();
  });

  it("토스 승인 응답의 orderId가 다름 → 지급 거부", async () => {
    const orderId = await createPendingOrder();
    nextConfirmOverride = (req) => ({
      ok: true,
      payment: { paymentKey: req.paymentKey, orderId: "someone-elses-order", status: "DONE", totalAmount: 8900 },
    });

    expect(await confirmOrderPayment({ paymentKey: "pk_1", orderId, amount: 8900 })).toEqual({ status: "amount_mismatch" });
    expect(addCreditsMock).not.toHaveBeenCalled();
  });

  it("다른(싼) 주문의 결제로 비싼 주문을 승인 시도 → 금액 불일치로 거부", async () => {
    const cheapOrder = await createPendingOrder("pack5");
    const expensiveOrder = await createPendingOrder("pack20");
    tossState.set("pk_cheap", { paymentKey: "pk_cheap", orderId: cheapOrder, status: "DONE", totalAmount: 4900 });

    // 비싼 주문의 콜백에 싼 결제의 금액을 넣으면 콜백 단계에서, 맞는 금액을 넣으면 승인 응답 검증에서 막힌다.
    expect(await confirmOrderPayment({ paymentKey: "pk_cheap", orderId: expensiveOrder, amount: 4900 })).toEqual({
      status: "amount_mismatch",
    });
    expect(addCreditsMock).not.toHaveBeenCalled();
  });
});

describe("웹훅 출처 검증 — 본문은 믿지 않고 토스 재조회 결과만 사용", () => {
  it("토스에 없는 paymentKey로 DONE 웹훅 위조 → 거부, 지급 없음", async () => {
    await createPendingOrder();
    expect(await handleTossWebhook(webhook("forged_pk"))).toBe("rejected");
    expect(fakeToss.getPayment).toHaveBeenCalledWith("forged_pk");
    expect(addCreditsMock).not.toHaveBeenCalled();
  });

  it("본문은 DONE이지만 토스 실제 상태는 CANCELED → 지급 없이 canceled 처리", async () => {
    const orderId = await createPendingOrder();
    tossState.set("pk_1", { paymentKey: "pk_1", orderId, status: "CANCELED", totalAmount: 8900 });

    expect(await handleTossWebhook(webhook("pk_1", { status: "DONE" }))).toBe("marked_canceled");
    expect(getFakeOrder(orderId)?.status).toBe("canceled");
    expect(addCreditsMock).not.toHaveBeenCalled();
  });

  it("본문 금액을 부풀려도 토스 조회 금액 기준으로 판단", async () => {
    const orderId = await createPendingOrder("pack5");
    tossState.set("pk_1", { paymentKey: "pk_1", orderId, status: "DONE", totalAmount: 4900 });

    expect(await handleTossWebhook(webhook("pk_1", { totalAmount: 1_000_000 }))).toBe("granted");
    expect(addCreditsMock).toHaveBeenCalledExactlyOnceWith(USER, 5);
  });

  it("PAYMENT_STATUS_CHANGED가 아닌 이벤트/paymentKey 없음 → 무시/거부", async () => {
    expect(await handleTossWebhook({ eventType: "DEPOSIT_CALLBACK", data: {} })).toBe("ignored");
    expect(await handleTossWebhook({ eventType: "PAYMENT_STATUS_CHANGED", data: {} })).toBe("rejected");
    expect(await handleTossWebhook(null)).toBe("ignored");
    expect(fakeToss.getPayment).not.toHaveBeenCalled();
  });
});

describe("실패/취소", () => {
  it("토스 승인 실패 → failed, 지급 없음", async () => {
    const orderId = await createPendingOrder();
    nextConfirmOverride = () => ({ ok: false, code: "REJECT_CARD_PAYMENT", message: "한도초과" });

    expect(await confirmOrderPayment({ paymentKey: "pk_1", orderId, amount: 8900 })).toMatchObject({
      status: "failed",
      code: "REJECT_CARD_PAYMENT",
    });
    expect(getFakeOrder(orderId)?.status).toBe("failed");
    expect(addCreditsMock).not.toHaveBeenCalled();
  });

  it("failUrl 콜백 → 본인 주문만 failed, 남의 주문은 변경 불가", async () => {
    const orderId = await createPendingOrder();
    await failOrder(OTHER_USER, orderId, "PAY_PROCESS_CANCELED", "사용자 취소");
    expect(getFakeOrder(orderId)?.status).toBe("pending");

    await failOrder(USER, orderId, "PAY_PROCESS_CANCELED", "사용자 취소");
    expect(getFakeOrder(orderId)?.status).toBe("failed");
    expect(addCreditsMock).not.toHaveBeenCalled();
  });

  it("지급 완료된 주문에 늦은 fail 콜백 → paid 유지", async () => {
    const orderId = await createPendingOrder();
    await confirmOrderPayment({ paymentKey: "pk_1", orderId, amount: 8900 });
    await failOrder(USER, orderId, "PAY_PROCESS_CANCELED", "늦은 콜백");
    expect(getFakeOrder(orderId)?.status).toBe("paid");
  });

  it("존재하지 않는 orderId 콜백 → order_not_found, 승인/지급 없음", async () => {
    expect(await confirmOrderPayment({ paymentKey: "pk_1", orderId: "nope", amount: 8900 })).toEqual({
      status: "order_not_found",
    });
    expect(fakeToss.confirm).not.toHaveBeenCalled();
    expect(addCreditsMock).not.toHaveBeenCalled();
  });
});
