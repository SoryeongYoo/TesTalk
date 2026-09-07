import type { OpicQuestion } from "@testalk/shared";

/** 생성된 문항 1개를 보여주는 임시 결과 카드 — 응시(녹음) 기능 전, 생성 결과 확인용. */
export function QuestionCard({ question }: { question: OpicQuestion }) {
  return (
    <li className="rounded-2xl border-2 border-slate-100 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">
          {question.slot_no}번
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1">{question.function}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1">topic: {question.topic}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1">{question.source}</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-800">{question.text_en}</p>
      <p className="mt-1 text-sm text-slate-500">{question.text_ko}</p>
    </li>
  );
}
