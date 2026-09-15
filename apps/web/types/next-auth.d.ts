import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      /** Cognito sub (고유 사용자 ID). 크레딧 소유자 식별에 사용 예정. */
      id: string;
    } & DefaultSession["user"];
  }
}
