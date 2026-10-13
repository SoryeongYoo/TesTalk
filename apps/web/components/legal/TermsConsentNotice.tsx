import Link from "next/link";
import { LEGAL_DOCUMENTS } from "@/lib/legal/documents";

/**
 * 로그인 버튼 아래 붙이는 약관 동의 간주 문구. Cognito는 최초 로그인 = 가입이라
 * 별도 가입 화면이 없으므로, 로그인을 시작하는 지점에 노출한다.
 * tone은 배경에 맞춘 링크 색만 바꾼다 (dark: 홈 화면의 어두운 배경).
 */
export function TermsConsentNotice({
  tone = "light",
  className = "",
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  const link =
    tone === "dark"
      ? "text-slate-300 underline underline-offset-2 hover:text-white"
      : "text-slate-600 underline underline-offset-2 hover:text-emerald-700";

  return (
    <p className={`break-keep text-[11px] leading-relaxed text-slate-400 ${className}`}>
      로그인(가입) 시{" "}
      <Link href={LEGAL_DOCUMENTS.terms.href} className={link}>
        {LEGAL_DOCUMENTS.terms.title}
      </Link>{" "}
      및{" "}
      <Link href={LEGAL_DOCUMENTS.privacy.href} className={`font-bold ${link}`}>
        {LEGAL_DOCUMENTS.privacy.title}
      </Link>
      에 동의한 것으로 봅니다.
    </p>
  );
}
