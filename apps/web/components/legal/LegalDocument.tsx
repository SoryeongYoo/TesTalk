import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { LEGAL_DOCUMENTS, type LegalDocumentId } from "@/lib/legal/documents";

/** 약관 마크다운의 제목/조항/목록/표를 읽기 좋은 간격으로 렌더링한다. 페이지 제목(h1)과 겹치지 않게 # 은 h2로 내린다. */
const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => <h2 className="mt-10 text-xl font-bold text-slate-800">{children}</h2>,
  h2: ({ children }) => (
    <h2 className="mt-10 border-b border-slate-200 pb-2 text-lg font-bold text-slate-800">{children}</h2>
  ),
  h3: ({ children }) => <h3 className="mt-6 text-base font-bold text-slate-800">{children}</h3>,
  h4: ({ children }) => <h4 className="mt-4 text-sm font-bold text-slate-700">{children}</h4>,
  p: ({ children }) => <p className="mt-3 text-sm leading-7 text-slate-600">{children}</p>,
  ul: ({ children }) => (
    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-7 text-slate-600">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-7 text-slate-600">{children}</ol>
  ),
  strong: ({ children }) => <strong className="font-semibold text-slate-800">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800">
      {children}
    </a>
  ),
  hr: () => <hr className="my-8 border-slate-200" />,
  blockquote: ({ children }) => (
    <blockquote className="mt-4 rounded-xl bg-slate-50 px-4 py-1 text-slate-600">{children}</blockquote>
  ),
  table: ({ children }) => (
    <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm text-slate-600">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-700">{children}</th>
  ),
  td: ({ children }) => <td className="border-b border-slate-100 px-3 py-2 align-top">{children}</td>,
};

export function LegalDocument({ id }: { id: LegalDocumentId }) {
  const doc = LEGAL_DOCUMENTS[id];

  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-emerald-50 to-white">
      <article className="w-full max-w-3xl flex-1 break-keep px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <p className="text-sm font-semibold text-emerald-600">약관 및 정책</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-800 sm:text-3xl">{doc.title}</h1>
        <div className="mt-6 rounded-2xl border-2 border-emerald-100 bg-white p-5 sm:p-8 [&>*:first-child]:mt-0">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
            {doc.markdown}
          </ReactMarkdown>
        </div>
      </article>
    </main>
  );
}
