import Link from "next/link";
import { BUSINESS_INFO } from "@/lib/businessInfo";
import { LEGAL_DOCUMENTS } from "@/lib/legal/documents";

/** 전자상거래법 표시 순서: 상호 | 대표자 | 사업장주소 | 사업자등록번호 | 통신판매업신고번호 | 전화 | 이메일 | 호스팅 */
const BUSINESS_FIELDS = [
  { label: "상호", value: BUSINESS_INFO.companyName },
  { label: "대표자", value: BUSINESS_INFO.ceoName },
  { label: "사업장주소", value: BUSINESS_INFO.address },
  { label: "사업자등록번호", value: BUSINESS_INFO.businessRegistrationNumber },
  { label: "통신판매업신고번호", value: BUSINESS_INFO.mailOrderSalesNumber },
  { label: "전화", value: BUSINESS_INFO.phone },
  { label: "이메일", value: BUSINESS_INFO.email },
  { label: "개인정보보호책임자", value: `${BUSINESS_INFO.privacyOfficer} (${BUSINESS_INFO.privacyOfficerEmail})` },
  { label: "호스팅", value: `AWS (${BUSINESS_INFO.hostingProvider})` },
] as const;

const FOOTER_LINKS = [
  { ...LEGAL_DOCUMENTS.terms, emphasized: false },
  { ...LEGAL_DOCUMENTS.privacy, emphasized: true },
  { ...LEGAL_DOCUMENTS.refund, emphasized: false },
] as const;

/** 모든 페이지 하단의 사업자 정보 + 약관 링크. 모바일은 세로, sm 이상은 구분선(|)으로 가로 나열. */
export function Footer() {
  return (
    <footer className="break-keep border-t border-slate-200 bg-slate-50">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <nav aria-label="약관 및 정책">
          <ul className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:items-center">
            {FOOTER_LINKS.map((link, index) => (
              <li key={link.href} className="flex items-center">
                {index > 0 && (
                  <span aria-hidden="true" className="mr-2 hidden h-3 w-px bg-slate-300 sm:inline-block" />
                )}
                <Link
                  href={link.href}
                  className={`hover:text-emerald-700 ${link.emphasized ? "font-bold text-slate-800" : "text-slate-600"}`}
                >
                  {link.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <ul className="mt-5 flex flex-col gap-1 text-xs leading-relaxed text-slate-500 sm:flex-row sm:flex-wrap sm:gap-x-2">
          {BUSINESS_FIELDS.map((field, index) => (
            <li key={field.label} className="flex items-center">
              {index > 0 && (
                <span aria-hidden="true" className="mr-2 hidden h-2.5 w-px bg-slate-300 sm:inline-block" />
              )}
              <span className="text-slate-400">{field.label}</span>
              <span className="ml-1.5">{field.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
