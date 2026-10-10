/**
 * 크레딧 충전 패키지 정의 — UI(충전 페이지)와 서버(purchaseCredits)가 공유하는 단일 출처.
 *
 * ⚠️ 서버는 클라이언트가 보낸 가격/크레딧 수를 절대 믿지 않는다. 클라이언트는 `id`만
 * 보내고, 서버가 findCreditPackage(id)로 이 표에서 금액과 지급 크레딧 수를 결정한다.
 */
export const CREDIT_PACKAGES = [
  { id: "pack5", credits: 5, priceKrw: 4900 },
  { id: "pack10", credits: 10, priceKrw: 8900 },
  { id: "pack20", credits: 20, priceKrw: 15900 },
] as const;

export type CreditPackage = (typeof CREDIT_PACKAGES)[number];
export type CreditPackageId = CreditPackage["id"];

/** id로 패키지를 찾는다. 모르는 id(위조 포함)면 null. */
export function findCreditPackage(id: unknown): CreditPackage | null {
  return CREDIT_PACKAGES.find((pkg) => pkg.id === id) ?? null;
}

/** 1회(1크레딧)당 가격 — 표시용. 원 단위 내림. */
export function pricePerCreditKrw(pkg: CreditPackage): number {
  return Math.floor(pkg.priceKrw / pkg.credits);
}
