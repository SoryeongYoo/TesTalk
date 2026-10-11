import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { failOrder } from "@/lib/server/purchaseCredits";
import { redirectToCredits } from "../redirect";

export const dynamic = "force-dynamic";

/**
 * 토스 결제창 failUrl. 토스가 ?code&message&orderId를 붙여 리다이렉트한다 (사용자 취소 포함).
 * 로그인한 본인 주문만 pending → failed로 바꾸고, 크레딧은 지급하지 않는다.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code") ?? "UNKNOWN";
  const orderId = params.get("orderId");

  const session = await auth();
  if (orderId && session?.user?.id) {
    try {
      await failOrder(session.user.id, orderId, code, params.get("message") ?? "");
    } catch (err) {
      console.error(`[toss:fail] 실패 기록 중 오류 — order=${orderId}`, err);
    }
  }
  return redirectToCredits(request, code === "PAY_PROCESS_CANCELED" ? "canceled" : "failed");
}
