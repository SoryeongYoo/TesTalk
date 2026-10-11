import type { ConfirmRequest, PaymentProvider, ProviderPaymentResult } from "./types";

/**
 * 실제 과금 없이 항상 승인 성공을 돌려주는 테스트용 provider.
 *
 * ⚠️ 이 provider가 성공하면 크레딧이 공짜로 지급된다. 직접 생성하지 말고
 * payments/index.ts의 getPaymentProvider()를 통해서만 얻는다 — 거기서
 * TESTALK_ALLOW_TEST_GRANT=true이고 토스 키가 없을 때만 이 provider를 돌려준다.
 */
export class StubPaymentProvider implements PaymentProvider {
  readonly name = "stub" as const;
  readonly checkout = "instant" as const;

  async confirm(request: ConfirmRequest): Promise<ProviderPaymentResult> {
    console.log(`[payments:stub] 테스트 승인(실과금 없음) — order=${request.orderId}, amount=${request.amountKrw}원`);
    return {
      ok: true,
      payment: {
        paymentKey: request.paymentKey,
        orderId: request.orderId,
        status: "DONE",
        totalAmount: request.amountKrw,
      },
    };
  }

  async getPayment(): Promise<ProviderPaymentResult> {
    return { ok: false, code: "NOT_SUPPORTED", message: "stub provider는 결제 조회를 지원하지 않습니다." };
  }
}
