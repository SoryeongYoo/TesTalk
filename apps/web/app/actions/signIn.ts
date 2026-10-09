"use server";

import { signIn } from "@/auth";

/**
 * 클라이언트 화면(/level)에서 로그인을 시작하는 Server Action.
 * 로그인 후 돌아올 곳은 /level로 고정한다 — 설문 결과는 같은 탭의 sessionStorage에
 * 남아 있으므로 돌아오면 바로 다시 생성할 수 있다. (redirectTo를 인자로 받지 않아
 * 오픈 리다이렉트 여지를 두지 않는다.)
 */
export async function signInToGenerate(): Promise<void> {
  await signIn("cognito", { redirectTo: "/level" });
}
