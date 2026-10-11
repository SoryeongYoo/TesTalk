"use server";

import { auth } from "@/auth";
import { startPurchase, type StartPurchaseResult } from "@/lib/server/purchaseCredits";

/**
 * Server Action 진입점. 로그인 확인 후 세션의 본인 userId로만 주문을 만든다.
 * 인자는 packageId 하나뿐 — userId, 가격, 크레딧 수는 클라이언트에서 받지 않는다.
 *
 * - 토스: 주문(pending)만 만들고 결제창 파라미터를 돌려준다. 승인/지급은 서버의
 *   successUrl 콜백(/api/payments/toss/success)에서만 일어난다.
 * - stub(로컬 테스트): 바로 지급까지 끝낸다.
 */
export async function purchaseCredits(
  packageId: string,
): Promise<StartPurchaseResult | { status: "login_required" }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "login_required" };
  }
  return startPurchase(session.user.id, packageId);
}
