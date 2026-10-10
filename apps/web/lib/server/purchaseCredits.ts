import { randomUUID } from "node:crypto";
import { findCreditPackage } from "@testalk/shared";
import { addCredits } from "./credits";
import { getPaymentProvider } from "./payments";

/**
 * ⚠️ 서버 전용. 크레딧 구매의 유일한 경로: 패키지 조회 → 결제 → 지급.
 *
 * - 금액/지급 크레딧 수는 packageId로 서버가 shared의 CREDIT_PACKAGES에서 결정한다.
 * - 결제는 PaymentProvider 인터페이스로만 호출한다 (지금은 stub, 나중에 토스).
 * - 결제 성공으로 판정된 경우에만 기존 addCredits(원자적 UPDATE)로 지급한다.
 *
 * 인증은 이 함수의 책임이 아니다 — 호출부(Server Action)가 세션에서 꺼낸 userId만 넘긴다.
 */

export type PurchaseCreditsResult =
  | { status: "ok"; credits: number; creditBalance: number; paymentId: string }
  | { status: "invalid_package" }
  | { status: "payment_unavailable" }
  | { status: "payment_failed"; reason: string };

export async function purchaseCreditsForUser(userId: string, packageId: unknown): Promise<PurchaseCreditsResult> {
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
  const charged = await provider.charge({
    userId,
    orderId,
    amountKrw: pkg.priceKrw,
    orderName: `TesTalk 크레딧 ${pkg.credits}개`,
  });
  if (!charged.ok) {
    console.warn(`[purchaseCredits] 결제 실패 — user=${userId}, order=${orderId}, reason=${charged.reason}`);
    return { status: "payment_failed", reason: charged.reason };
  }

  // TODO(토스 연동): 실결제가 붙으면 여기서 (1) paymentId 기준 중복 지급 방지(구매 기록 테이블의
  // unique 제약) (2) 지급 실패 시 결제 취소/재시도가 필요하다. stub 단계에선 실과금이 없어 생략한다.
  const creditBalance = await addCredits(userId, pkg.credits);
  console.log(
    `[purchaseCredits] 지급 완료 — provider=${provider.name}, user=${userId}, package=${pkg.id}, +${pkg.credits}, balance=${creditBalance}, payment=${charged.paymentId}`,
  );
  return { status: "ok", credits: pkg.credits, creditBalance, paymentId: charged.paymentId };
}
