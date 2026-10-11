/**
 * ⚠️ 서버 전용. 결제 provider 경계.
 *
 * 주문 생성/금액 결정/멱등 지급은 provider와 무관하게 lib/server/purchaseCredits.ts가 한다.
 * provider는 "PG에 승인을 요청"(confirm)하고 "PG에서 결제 상태를 다시 조회"(getPayment)하는
 * 두 가지만 책임진다. 새 PG를 붙일 때는 이 인터페이스만 구현하면 된다.
 */

/** PG가 알려준 결제 상태 — 호출부는 이 값만 믿는다(클라이언트/웹훅 본문 값이 아니라). */
export interface ProviderPayment {
  paymentKey: string;
  orderId: string;
  /** 토스 결제 상태 그대로: READY, IN_PROGRESS, WAITING_FOR_DEPOSIT, DONE, CANCELED, PARTIAL_CANCELED, ABORTED, EXPIRED */
  status: string;
  /** PG가 실제로 승인한 총 결제 금액(원). */
  totalAmount: number;
}

export type ProviderPaymentResult =
  | { ok: true; payment: ProviderPayment }
  | { ok: false; code: string; message: string };

export interface ConfirmRequest {
  paymentKey: string;
  orderId: string;
  /** 서버가 패키지 표에서 결정한 금액. 클라이언트 값이 아니다. */
  amountKrw: number;
}

export interface PaymentProvider {
  readonly name: "toss" | "stub";
  /**
   * - "redirect": 클라이언트가 PG 결제창을 띄우고, 성공 시 successUrl 콜백에서 서버가 confirm한다 (토스).
   * - "instant": 결제창 없이 서버가 주문 생성 직후 바로 confirm한다 (테스트용 stub).
   */
  readonly checkout: "redirect" | "instant";
  /** 결제창 SDK 초기화용 공개 키 (redirect일 때만). 시크릿 키는 절대 여기 두지 않는다. */
  readonly clientKey?: string;
  /** PG 승인 요청 — 서버에서만 호출한다. */
  confirm(request: ConfirmRequest): Promise<ProviderPaymentResult>;
  /** paymentKey로 PG의 현재 결제 상태를 조회한다 (웹훅 출처 검증, 승인 재확인용). */
  getPayment(paymentKey: string): Promise<ProviderPaymentResult>;
}
