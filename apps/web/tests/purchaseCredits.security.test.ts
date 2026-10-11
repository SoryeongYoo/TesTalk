import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

/**
 * purchaseCredits Server Action 보안 테스트.
 *
 * 실제 DB/세션 없이 경계만 검증한다:
 * - auth()는 mock — 테스트가 세션 유저를 정한다.
 * - addCredits(실제 지급)는 mock — "지급 안 됨" = addCredits가 한 번도 호출되지 않음.
 * - 주문 저장소(creditOrders)는 메모리 fake — 조건부 상태 전환 의미는 실제 SQL과 같다.
 * - StubPaymentProvider.confirm은 spy — 결제 승인 시도 자체가 일어났는지/금액이 무엇인지 확인.
 */

const SESSION_USER = "session-user-sub";
const VICTIM_USER = "victim-user-sub";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const addCreditsMock = vi.fn(async (_userId: string, amount: number) => 100 + amount);
vi.mock("@/lib/server/credits", () => ({
  addCredits: (userId: string, amount: number) => addCreditsMock(userId, amount),
}));

vi.mock("@/lib/server/creditOrders", () => import("./helpers/fakeCreditOrders"));

import { purchaseCredits } from "@/app/actions/purchaseCredits";
import { allFakeOrders, resetFakeOrders } from "./helpers/fakeCreditOrders";
import { StubPaymentProvider } from "@/lib/server/payments/stubPaymentProvider";

/** 클라이언트가 시그니처를 무시하고 임의 인자를 보내는 상황을 흉내 낸다 (Server Action은 직렬화된 인자를 그대로 받는다). */
const callRaw = purchaseCredits as unknown as (...args: unknown[]) => ReturnType<typeof purchaseCredits>;

let confirmSpy: MockInstance<StubPaymentProvider["confirm"]>;
const ORIGINAL_FLAG = process.env.TESTALK_ALLOW_TEST_GRANT;

beforeEach(() => {
  // 토스 키가 있으면 토스가 우선 선택되므로, 이 파일(stub 경로 검증)에서는 지운다.
  vi.stubEnv("TOSS_CLIENT_KEY", "");
  vi.stubEnv("TOSS_SECRET_KEY", "");
  resetFakeOrders();
  authMock.mockResolvedValue({ user: { id: SESSION_USER, email: "user@example.com" } });
  addCreditsMock.mockClear();
  confirmSpy = vi.spyOn(StubPaymentProvider.prototype, "confirm");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  process.env.TESTALK_ALLOW_TEST_GRANT = "true"; // 1~3번은 "지급이 가능한 환경"에서도 막히는지 본다.
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  if (ORIGINAL_FLAG === undefined) delete process.env.TESTALK_ALLOW_TEST_GRANT;
  else process.env.TESTALK_ALLOW_TEST_GRANT = ORIGINAL_FLAG;
});

describe("대조군 — 정상 구매는 지급된다", () => {
  it("pack10 → 세션 유저에게 10 지급, 8900원 결제", async () => {
    const result = await purchaseCredits("pack10");
    expect(result).toMatchObject({ status: "ok", credits: 10 });
    expect(addCreditsMock).toHaveBeenCalledExactlyOnceWith(SESSION_USER, 10);
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(confirmSpy.mock.calls[0]![0]).toMatchObject({ amountKrw: 8900 });
    // 주문은 세션 유저 명의로, 서버가 정한 금액/크레딧으로 생성된다.
    expect(allFakeOrders()).toEqual([
      expect.objectContaining({ userId: SESSION_USER, packageId: "pack10", credits: 10, amount: 8900, status: "paid" }),
    ]);
  });
});

describe("1. 위조된 packageId", () => {
  it.each([
    ["존재하지 않는 id", "pack999"],
    ["빈 문자열", ""],
    ["null", null],
    ["undefined", undefined],
    ["SQL 인젝션 문자열", "pack5; DROP TABLE credits; --"],
    ["대소문자 변형", "PACK5"],
    ["공백 포함", " pack5 "],
    ["숫자", 5],
    ["배열", ["pack5"]],
  ])("%s → invalid_package, 결제/지급 없음", async (_label, packageId) => {
    const result = await callRaw(packageId);
    expect(result).toEqual({ status: "invalid_package" });
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(addCreditsMock).not.toHaveBeenCalled();
  });
});

describe("2. 금액/크레딧 위조", () => {
  it("packageId 자리에 {id, credits, priceKrw} 객체 → 거부", async () => {
    const result = await callRaw({ id: "pack10", credits: 9999, priceKrw: 1 });
    expect(result).toEqual({ status: "invalid_package" });
    expect(addCreditsMock).not.toHaveBeenCalled();
  });

  it("추가 인자로 credits/priceKrw를 보내도 무시 — 서버 패키지 값(5개, 4900원)만 반영", async () => {
    const result = await callRaw("pack5", { credits: 9999, priceKrw: 1 });
    expect(result).toMatchObject({ status: "ok", credits: 5 });
    expect(addCreditsMock).toHaveBeenCalledExactlyOnceWith(SESSION_USER, 5);
    expect(confirmSpy.mock.calls[0]![0]).toMatchObject({ amountKrw: 4900 });
  });
});

describe("3. 유저 격리", () => {
  it("비로그인(세션 없음) → login_required, 결제/지급 없음", async () => {
    authMock.mockResolvedValue(null);
    expect(await purchaseCredits("pack5")).toEqual({ status: "login_required" });
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(addCreditsMock).not.toHaveBeenCalled();
  });

  it("세션은 있지만 user.id 없음 → login_required", async () => {
    authMock.mockResolvedValue({ user: { email: "user@example.com" } });
    expect(await purchaseCredits("pack5")).toEqual({ status: "login_required" });
    expect(addCreditsMock).not.toHaveBeenCalled();
  });

  it("비로그인 + 다른 userId를 인자로 전달 → 거부, 피해자에게 지급 없음", async () => {
    authMock.mockResolvedValue(null);
    expect(await callRaw("pack5", VICTIM_USER)).toEqual({ status: "login_required" });
    expect(addCreditsMock).not.toHaveBeenCalled();
  });

  it("로그인 + 다른 userId를 인자/객체로 전달 → 세션 유저에게만 지급", async () => {
    await callRaw("pack5", VICTIM_USER);
    await callRaw("pack5", { userId: VICTIM_USER });
    expect(addCreditsMock).toHaveBeenCalledTimes(2);
    for (const [userId] of addCreditsMock.mock.calls) {
      expect(userId).toBe(SESSION_USER);
    }
    expect(addCreditsMock.mock.calls.some(([userId]) => userId === VICTIM_USER)).toBe(false);
  });
});

describe("4. 프로덕션 안전장치 (TESTALK_ALLOW_TEST_GRANT)", () => {
  it.each([
    ["미설정", undefined],
    ["false", "false"],
    ["빈 문자열", ""],
    ["대문자 TRUE", "TRUE"],
    ["1", "1"],
    ["yes", "yes"],
  ])("플래그 %s → payment_unavailable, 결제/지급 없음", async (_label, flag) => {
    if (flag === undefined) delete process.env.TESTALK_ALLOW_TEST_GRANT;
    else process.env.TESTALK_ALLOW_TEST_GRANT = flag;

    expect(await purchaseCredits("pack20")).toEqual({ status: "payment_unavailable" });
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(addCreditsMock).not.toHaveBeenCalled();
  });
});
