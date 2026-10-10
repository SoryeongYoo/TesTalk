import { randomUUID } from "node:crypto";
import type { ChargeRequest, ChargeResult, PaymentProvider } from "./types";

/**
 * 실제 과금 없이 항상 성공을 돌려주는 테스트용 provider.
 *
 * ⚠️ 이 provider가 성공하면 크레딧이 공짜로 지급된다. 직접 생성하지 말고
 * payments/index.ts의 getPaymentProvider()를 통해서만 얻는다 — 거기서
 * TESTALK_ALLOW_TEST_GRANT=true일 때만 이 provider를 돌려준다.
 */
export class StubPaymentProvider implements PaymentProvider {
  readonly name = "stub";

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    console.log(
      `[payments:stub] 테스트 지급(실과금 없음) — user=${request.userId}, order=${request.orderId}, amount=${request.amountKrw}원`,
    );
    return { ok: true, paymentId: `stub_${randomUUID()}` };
  }
}
