import Link from "next/link";
import { auth, signIn } from "@/auth";
import { getCreditBalance } from "@/lib/server/credits";
import { getPaymentProvider, isTestGrantAllowed } from "@/lib/server/payments";
import { CreditPurchasePanel } from "@/components/credits/CreditPurchasePanel";
import { TermsConsentNotice } from "@/components/legal/TermsConsentNotice";
import { LEGAL_DOCUMENTS } from "@/lib/legal/documents";

/** 잔액/테스트 모드 여부를 요청마다 서버에서 읽는다 (정적 캐싱 금지). */
export const dynamic = "force-dynamic";

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: { payment?: string | string[] };
}) {
  const session = await auth();
  const paymentResult = typeof searchParams.payment === "string" ? searchParams.payment : undefined;

  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-emerald-50 to-white">
      <div className="w-full max-w-lg flex-1 px-6 pb-16 pt-8">
        <p className="text-sm font-semibold text-emerald-600">크레딧 충전</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-800">채점 응시 크레딧</h1>
        <p className="mt-1 text-sm text-slate-500">많이 살수록 회당 가격이 저렴해져요.</p>

        <div className="mt-6">
          {session?.user?.id ? (
            <CreditPurchasePanel
              initialBalance={await getCreditBalance(session.user.id)}
              testMode={isTestGrantAllowed() && getPaymentProvider()?.name === "stub"}
              paymentResult={paymentResult}
            />
          ) : (
            <div className="rounded-2xl border-2 border-emerald-100 bg-white p-8 text-center">
              <p className="text-sm text-slate-500">크레딧을 충전하려면 로그인이 필요해요.</p>
              <form
                action={async () => {
                  "use server";
                  await signIn("cognito", { redirectTo: "/credits" });
                }}
                className="mt-4"
              >
                <button
                  type="submit"
                  className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-600"
                >
                  로그인하기
                </button>
              </form>
              <TermsConsentNotice className="mt-3" />
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          결제 전{" "}
          <Link
            href={LEGAL_DOCUMENTS.refund.href}
            className="font-semibold text-slate-700 underline underline-offset-2 hover:text-emerald-700"
          >
            {LEGAL_DOCUMENTS.refund.title}
          </Link>
          을 확인해주세요.
        </p>
      </div>
    </main>
  );
}
