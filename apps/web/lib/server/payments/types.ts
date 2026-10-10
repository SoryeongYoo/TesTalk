/**
 * ⚠️ 서버 전용. 결제 provider 경계.
 *
 * purchaseCredits는 이 인터페이스만 알고, 실제 PG(토스페이먼츠 등)는 모른다.
 * 토스 연동 시 TossPaymentProvider가 이 인터페이스를 구현하고 payments/index.ts의
 * getPaymentProvider()만 바꾸면 된다 — 패키지 조회/크레딧 지급 로직은 그대로다.
 */

export interface ChargeRequest {
  /** 결제하는 사용자 (서버 세션에서 온 Cognito sub). */
  userId: string;
  /** 이 구매 시도의 고유 주문 id — PG 쪽 멱등성 키로 쓴다. */
  orderId: string;
  /** 서버가 패키지 표에서 결정한 금액. 클라이언트 값이 아니다. */
  amountKrw: number;
  /** PG 결제창/영수증에 표시할 상품명. */
  orderName: string;
}

export type ChargeResult =
  | { ok: true; paymentId: string }
  | { ok: false; reason: string };

export interface PaymentProvider {
  /** 식별용 이름 (로그). */
  readonly name: string;
  charge(request: ChargeRequest): Promise<ChargeResult>;
}
