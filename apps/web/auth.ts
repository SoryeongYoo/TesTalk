import NextAuth from "next-auth";
import Cognito from "next-auth/providers/cognito";

/**
 * AWS Cognito 로그인 설정.
 * COGNITO_CLIENT_SECRET은 여기(서버 전용 모듈)에서만 읽히며,
 * 클라이언트 번들에는 포함되지 않는다.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
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
});
