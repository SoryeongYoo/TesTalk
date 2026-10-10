"use server";

import { auth } from "@/auth";
import { purchaseCreditsForUser, type PurchaseCreditsResult } from "@/lib/server/purchaseCredits";

/**
 * Server Action 진입점. 로그인 확인 후 세션의 본인 userId로만 구매/지급한다.
 * 인자는 packageId 하나뿐 — userId, 가격, 크레딧 수는 클라이언트에서 받지 않는다.
 * 실제 로직은 lib/server/purchaseCredits.ts에 있다.
 */
export async function purchaseCredits(
  packageId: string,
): Promise<PurchaseCreditsResult | { status: "login_required" }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "login_required" };
  }
  return purchaseCreditsForUser(session.user.id, packageId);
}
