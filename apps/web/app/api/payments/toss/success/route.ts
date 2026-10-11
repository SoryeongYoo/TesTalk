import type { NextRequest } from "next/server";
import { confirmOrderPayment } from "@/lib/server/purchaseCredits";
import { redirectToCredits } from "../redirect";

export const dynamic = "force-dynamic";

/**
 * 토스 결제창 successUrl. 토스가 ?paymentKey&orderId&amount를 붙여 리다이렉트한다.
 * 여기서 서버가 승인 API를 호출하고(시크릿 키), 승인·금액 검증을 통과해야만 지급한다.
 * 새로고침/중복 호출은 confirmOrderPayment가 already_paid로 막는다.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const paymentKey = params.get("paymentKey");
  const orderId = params.get("orderId");
  const amount = Number(params.get("amount"));
  if (!paymentKey || !orderId || !Number.isInteger(amount)) {
    return redirectToCredits(request, "invalid");
  }

  try {
    const result = await confirmOrderPayment({ paymentKey, orderId, amount });
    return redirectToCredits(request, result.status);
  } catch (err) {
    console.error(`[toss:success] 승인 처리 중 오류 — order=${orderId}`, err);
    return redirectToCredits(request, "error");
  }
}
