import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { LEGAL_DOCUMENTS } from "@/lib/legal/documents";

export const metadata: Metadata = { title: `${LEGAL_DOCUMENTS.refund.title} | AI 오픽 모의고사` };

export default function RefundPage() {
  return <LegalDocument id="refund" />;
}
