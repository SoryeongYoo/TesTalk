import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { LEGAL_DOCUMENTS } from "@/lib/legal/documents";

export const metadata: Metadata = { title: `${LEGAL_DOCUMENTS.terms.title} | AI 오픽 모의고사` };

export default function TermsPage() {
  return <LegalDocument id="terms" />;
}
