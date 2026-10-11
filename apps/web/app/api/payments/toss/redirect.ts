import { NextResponse, type NextRequest } from "next/server";

/**
 * /credits로 결과와 함께 리다이렉트한다.
 * Amplify(CloudFront) 프록시 뒤에서는 request.url의 호스트가 내부 주소일 수 있어
 * X-Forwarded-Host/Proto를 우선한다 (auth.ts의 trustHost와 같은 이유).
 */
export function redirectToCredits(request: NextRequest, payment: string): NextResponse {
  const host = request.headers.get("x-forwarded-host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const url = new URL(`${proto}://${host}/credits`);
  url.searchParams.set("payment", payment);
  return NextResponse.redirect(url, 303);
}
