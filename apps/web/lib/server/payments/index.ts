import { StubPaymentProvider } from "./stubPaymentProvider";
import { TossPaymentProvider } from "./tossPaymentProvider";
import type { PaymentProvider } from "./types";

export type {
  ConfirmRequest,
  PaymentProvider,
  ProviderPayment,
  ProviderPaymentResult,
} from "./types";

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

/** 토스 키가 둘 다 설정돼 있으면 [clientKey, secretKey]. 시크릿 키는 서버에서만 읽는다. */
function getTossKeys(): [string, string] | null {
  const clientKey = process.env.TOSS_CLIENT_KEY?.trim();
  const secretKey = process.env.TOSS_SECRET_KEY?.trim();
  return clientKey && secretKey ? [clientKey, secretKey] : null;
}

/**
 * 지금 사용할 결제 provider. null이면 결제 불가("결제 준비 중")이며 크레딧을 지급하지 않는다.
 *
 * 1) TOSS_CLIENT_KEY + TOSS_SECRET_KEY가 있으면 토스 (테스트/라이브는 키 접두사로 결정된다).
 * 2) 없고 TESTALK_ALLOW_TEST_GRANT=true면 stub (로컬 개발 전용).
 * 3) 둘 다 아니면 null.
 */
export function getPaymentProvider(): PaymentProvider | null {
  const tossKeys = getTossKeys();
  if (tossKeys) {
    return new TossPaymentProvider(...tossKeys);
  }
  if (isTestGrantAllowed()) {
    return new StubPaymentProvider();
  }
  return null;
}
