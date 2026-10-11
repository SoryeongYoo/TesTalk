import type { ConfirmRequest, PaymentProvider, ProviderPaymentResult } from "./types";

/**
 * 토스페이먼츠 provider (결제창 → successUrl → 서버 승인).
 *
 * ⚠️ 서버 전용. secretKey는 이 클래스 안에서만 Authorization 헤더로 쓰이고 밖으로 나가지 않는다.
 * 테스트 키(test_ck_/test_sk_)와 라이브 키(live_ck_/live_sk_)는 환경변수
 * TOSS_CLIENT_KEY / TOSS_SECRET_KEY만 바꾸면 교체된다 — 코드 변경 없음.
 *
 * API: https://docs.tosspayments.com/reference
 * - 승인: POST /v1/payments/confirm  { paymentKey, orderId, amount }
 * - 조회: GET  /v1/payments/{paymentKey}
 * 인증: Basic base64("{secretKey}:")
 */
const TOSS_API_BASE = "https://api.tosspayments.com/v1";
const REQUEST_TIMEOUT_MS = 15_000;

interface TossPaymentResponse {
  paymentKey?: unknown;
  orderId?: unknown;
  status?: unknown;
  totalAmount?: unknown;
}

interface TossErrorResponse {
  code?: unknown;
  message?: unknown;
}

export class TossPaymentProvider implements PaymentProvider {
  readonly name = "toss" as const;
  readonly checkout = "redirect" as const;
  readonly clientKey: string;
  readonly #authHeader: string;

  constructor(clientKey: string, secretKey: string) {
    this.clientKey = clientKey;
    this.#authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
  }

  confirm(request: ConfirmRequest): Promise<ProviderPaymentResult> {
    return this.#request("/payments/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 같은 주문의 승인 요청이 재전송돼도 토스가 한 번만 처리하도록 orderId를 멱등 키로 쓴다.
        "Idempotency-Key": request.orderId,
      },
      body: JSON.stringify({
        paymentKey: request.paymentKey,
        orderId: request.orderId,
        amount: request.amountKrw,
      }),
    });
  }

  getPayment(paymentKey: string): Promise<ProviderPaymentResult> {
    return this.#request(`/payments/${encodeURIComponent(paymentKey)}`, { method: "GET" });
  }

  async #request(path: string, init: RequestInit): Promise<ProviderPaymentResult> {
    let res: Response;
    try {
      res = await fetch(`${TOSS_API_BASE}${path}`, {
        ...init,
        headers: { ...init.headers, Authorization: this.#authHeader },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (err) {
      return { ok: false, code: "NETWORK_ERROR", message: (err as Error)?.message ?? "토스 API 호출 실패" };
    }

    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const error = (body ?? {}) as TossErrorResponse;
      return {
        ok: false,
        code: typeof error.code === "string" ? error.code : `HTTP_${res.status}`,
        message: typeof error.message === "string" ? error.message : "토스 API 오류",
      };
    }

    const payment = (body ?? {}) as TossPaymentResponse;
    if (
      typeof payment.paymentKey !== "string" ||
      typeof payment.orderId !== "string" ||
      typeof payment.status !== "string" ||
      typeof payment.totalAmount !== "number"
    ) {
      return { ok: false, code: "INVALID_RESPONSE", message: "토스 응답 형식이 올바르지 않습니다." };
    }
    return {
      ok: true,
      payment: {
        paymentKey: payment.paymentKey,
        orderId: payment.orderId,
        status: payment.status,
        totalAmount: payment.totalAmount,
      },
    };
  }
}
