import { StubPaymentProvider } from "./stubPaymentProvider";
import type { PaymentProvider } from "./types";

export type { ChargeRequest, ChargeResult, PaymentProvider } from "./types";

/**
 * 테스트 지급(StubPaymentProvider) 허용 여부. 정확히 "true"일 때만 허용하고 기본은 false.
 *
 * ⚠️ 프로덕션에서 무료 크레딧이 지급되지 않게 하는 핵심 안전장치.
 * amplify.yml은 화이트리스트에 있는 환경변수만 런타임(.env.production)으로 넘기는데,
 * 이 변수는 일부러 화이트리스트에 넣지 않았다 — Amplify 콘솔에 설정해도 프로덕션에선 꺼져 있다.
 */
export function isTestGrantAllowed(): boolean {
  return process.env.TESTALK_ALLOW_TEST_GRANT === "true";
}

/**
 * 지금 사용할 결제 provider. null이면 결제 불가("결제 준비 중")이며 크레딧을 지급하지 않는다.
 *
 * 토스 연동 시: TossPaymentProvider(PaymentProvider 구현)를 만들어 여기서 반환하면 된다.
 * 호출부(lib/server/purchaseCredits.ts)는 바꿀 필요가 없다.
 */
export function getPaymentProvider(): PaymentProvider | null {
  if (isTestGrantAllowed()) {
    return new StubPaymentProvider();
  }
  return null;
}
