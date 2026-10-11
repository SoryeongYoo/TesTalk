import { afterEach, describe, expect, it, vi } from "vitest";
import { getPaymentProvider } from "@/lib/server/payments";
import { TossPaymentProvider } from "@/lib/server/payments/tossPaymentProvider";

/** provider 선택(환경변수)과 토스 API 호출 형태(시크릿 키 사용 위치) 검증. */

const SECRET = "test_sk_secretvalue";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getPaymentProvider — 환경변수로만 결정", () => {
  it("토스 키 둘 다 있으면 토스 (test grant 플래그보다 우선)", () => {
    vi.stubEnv("TOSS_CLIENT_KEY", "test_ck_abc");
    vi.stubEnv("TOSS_SECRET_KEY", SECRET);
    vi.stubEnv("TESTALK_ALLOW_TEST_GRANT", "true");
    const provider = getPaymentProvider();
    expect(provider?.name).toBe("toss");
    expect(provider?.clientKey).toBe("test_ck_abc");
  });

  it("토스 키 중 하나만 있으면 토스를 쓰지 않는다", () => {
    vi.stubEnv("TOSS_CLIENT_KEY", "test_ck_abc");
    vi.stubEnv("TOSS_SECRET_KEY", "");
    vi.stubEnv("TESTALK_ALLOW_TEST_GRANT", "");
    expect(getPaymentProvider()).toBeNull();
  });

  it("토스 키 없음 + 플래그 true → stub, 둘 다 없음 → null(결제 준비 중)", () => {
    vi.stubEnv("TOSS_CLIENT_KEY", "");
    vi.stubEnv("TOSS_SECRET_KEY", "");
    vi.stubEnv("TESTALK_ALLOW_TEST_GRANT", "true");
    expect(getPaymentProvider()?.name).toBe("stub");
    vi.stubEnv("TESTALK_ALLOW_TEST_GRANT", "");
    expect(getPaymentProvider()).toBeNull();
  });

  it("토스 provider 객체를 직렬화해도 시크릿 키가 드러나지 않는다", () => {
    const provider = new TossPaymentProvider("test_ck_abc", SECRET);
    const base64Secret = Buffer.from(`${SECRET}:`).toString("base64");
    const serialized = JSON.stringify(provider) + JSON.stringify(Object.entries(provider));
    expect(serialized).not.toContain(SECRET);
    expect(serialized).not.toContain(base64Secret);
  });
});

describe("TossPaymentProvider — 토스 API 호출 형태", () => {
  it("confirm: Basic 인증(시크릿 키), Idempotency-Key=orderId, 서버가 정한 금액 전송", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ paymentKey: "pk_1", orderId: "order_1", status: "DONE", totalAmount: 8900 }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new TossPaymentProvider("test_ck_abc", SECRET);
    const result = await provider.confirm({ paymentKey: "pk_1", orderId: "order_1", amountKrw: 8900 });

    expect(result).toEqual({
      ok: true,
      payment: { paymentKey: "pk_1", orderId: "order_1", status: "DONE", totalAmount: 8900 },
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.tosspayments.com/v1/payments/confirm");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from(`${SECRET}:`).toString("base64")}`);
    expect(headers["Idempotency-Key"]).toBe("order_1");
    expect(JSON.parse(init.body as string)).toEqual({ paymentKey: "pk_1", orderId: "order_1", amount: 8900 });
  });

  it("토스 에러 응답 → ok:false + 토스 에러 코드", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ code: "ALREADY_PROCESSED_PAYMENT", message: "이미 처리된 결제 입니다." }), {
          status: 400,
        }),
      ),
    );
    const result = await new TossPaymentProvider("test_ck_abc", SECRET).confirm({
      paymentKey: "pk_1",
      orderId: "order_1",
      amountKrw: 8900,
    });
    expect(result).toEqual({ ok: false, code: "ALREADY_PROCESSED_PAYMENT", message: "이미 처리된 결제 입니다." });
  });

  it("응답 형식이 이상하면(금액 누락 등) 성공으로 취급하지 않는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ paymentKey: "pk_1", orderId: "order_1", status: "DONE" }), { status: 200 })),
    );
    const result = await new TossPaymentProvider("test_ck_abc", SECRET).getPayment("pk_1");
    expect(result).toMatchObject({ ok: false, code: "INVALID_RESPONSE" });
  });

  it("네트워크 오류 → ok:false (예외로 새지 않음)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("ECONNRESET"))));
    const result = await new TossPaymentProvider("test_ck_abc", SECRET).getPayment("pk_1");
    expect(result).toMatchObject({ ok: false, code: "NETWORK_ERROR" });
  });
});
