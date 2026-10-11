import { NextResponse, type NextRequest } from "next/server";
import { handleTossWebhook } from "@/lib/server/purchaseCredits";

export const dynamic = "force-dynamic";

/**
 * 토스 결제 상태 웹훅 (개발자센터 > 웹훅에 이 URL을 PAYMENT_STATUS_CHANGED로 등록).
 *
 * 본문은 믿지 않는다 — handleTossWebhook이 paymentKey로 토스 조회 API를 다시 호출해
 * 그 응답으로만 상태를 갱신/지급한다 (멱등). 처리 완료/무시는 200, 일시적 오류는 500으로
 * 응답해 토스가 재전송하게 한다.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const result = await handleTossWebhook(body);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[toss:webhook] 처리 중 오류", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
