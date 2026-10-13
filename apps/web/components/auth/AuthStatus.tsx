import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, getCognitoLogoutUrl, signIn, signOut } from "@/auth";
import { getCreditBalance } from "@/lib/server/credits";

/**
 * 현재 로그인 상태를 보여주고 로그인/로그아웃을 트리거하는 최소 UI.
 * 서버 컴포넌트에서 session.user.email / session.user.id(Cognito sub)를 직접 읽는다.
 *
 * 크레딧 잔액은 이 컴포넌트가 렌더링되는 시점(페이지 진입/네비게이션)의 스냅샷이다 —
 * 같은 페이지 안에서 피드백을 받아 잔액이 바뀌는 실시간 반영은 /result 화면 자체의
 * 클라이언트 상태(app/result/page.tsx)가 담당한다.
 */
export async function AuthStatus() {
  const session = await auth();

  if (!session?.user) {
    return (
      <form
        action={async () => {
          "use server";
          await signIn("cognito");
        }}
      >
        <button
          type="submit"
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600"
        >
          로그인
        </button>
      </form>
    );
  }

  const balance = await getCreditBalance(session.user.id);

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/credits"
        className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
      >
        크레딧 {balance}개
        <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] text-white">충전</span>
      </Link>
      <div className="text-right">
        <p className="text-sm font-medium text-slate-700">{session.user.email}</p>
        <p className="text-xs text-slate-400">ID: {session.user.id}</p>
      </div>
      <form
        action={async () => {
          "use server";
          // 세션 쿠키만 지우고, 리다이렉트는 Cognito 로그아웃으로 직접 보낸다
          // (NextAuth의 redirectTo는 외부 도메인을 허용하지 않는다).
          const logoutUrl = getCognitoLogoutUrl();
          await signOut({ redirect: false });
          redirect(logoutUrl ?? "/");
        }}
      >
        <button
          type="submit"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}
