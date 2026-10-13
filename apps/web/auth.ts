import { headers } from "next/headers";
import NextAuth from "next-auth";
import Cognito from "next-auth/providers/cognito";
import { upsertUserOnLogin } from "./lib/server/db/upsertUser";

/**
 * AWS Cognito 로그인 설정.
 * COGNITO_CLIENT_SECRET은 여기(서버 전용 모듈)에서만 읽히며,
 * 클라이언트 번들에는 포함되지 않는다.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  // Amplify(CloudFront) 프록시 뒤에서는 서버가 자기 호스트를 localhost:3000으로
  // 인식해 UntrustedHost로 거부된다. X-Forwarded-Host를 신뢰하도록 config에 직접
  // 명시한다 — AUTH_TRUST_HOST 환경변수는 Amplify SSR 런타임에 전달이 보장되지 않는다.
  // 로컬 dev(NODE_ENV=development)는 원래 host를 신뢰하므로 동작 변화 없음.
  trustHost: true,
  providers: [
    Cognito({
      clientId: process.env.COGNITO_CLIENT_ID,
      clientSecret: process.env.COGNITO_CLIENT_SECRET,
      issuer: process.env.COGNITO_ISSUER,
    }),
  ],
  callbacks: {
    jwt({ token, profile }) {
      // Cognito의 sub(고유 ID)를 세션까지 전달하기 위해 토큰에 보존한다.
      if (profile?.sub) token.sub = profile.sub;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
  events: {
    // 로그인마다(최초/재로그인 모두) 호출되며, users/credits 행을 upsert한다.
    async signIn({ profile }) {
      if (profile?.sub && profile?.email) {
        await upsertUserOnLogin(profile.sub, profile.email);
      }
    },
  },
});

/**
 * Cognito Hosted UI 세션까지 끊는 로그아웃 URL.
 * NextAuth signOut은 우리 쿠키만 지우므로, 이 URL로 보내지 않으면 다음 로그인 때
 * Cognito가 기존 세션으로 자동 로그인해 계정 전환이 불가능하다.
 *
 * logout_uri는 Cognito 앱 클라이언트의 "허용된 로그아웃 URL"과 정확히 일치해야 한다.
 * COGNITO_LOGOUT_URI가 없으면 현재 요청의 origin(프록시 뒤면 X-Forwarded-*)을 쓴다.
 * COGNITO_DOMAIN이 없으면 null — 호출부는 NextAuth 세션만 지우는 기존 동작으로 남는다.
 */
export function getCognitoLogoutUrl(): string | null {
  const domain = process.env.COGNITO_DOMAIN;
  const clientId = process.env.COGNITO_CLIENT_ID;
  if (!domain || !clientId) return null;

  let logoutUri = process.env.COGNITO_LOGOUT_URI;
  if (!logoutUri) {
    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) return null;
    const proto =
      h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    logoutUri = `${proto}://${host}`;
  }

  const base = domain.startsWith("http") ? domain : `https://${domain}`;
  const url = new URL("/logout", base);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("logout_uri", logoutUri);
  return url.toString();
}
