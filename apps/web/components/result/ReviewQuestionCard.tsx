import { getBlueprintSlot, type ExamSessionQuestion } from "@testalk/shared";

interface ReviewQuestionCardProps {
  question: ExamSessionQuestion;
  isSpeaking: boolean;
  onPlayQuestion: () => void;
}

/**
 * 결과 화면(/result)에서 문항 하나를 되짚어보는 카드.
 * 문항 정보 + 문제 오디오 다시 듣기 + 내 녹음 재생(없으면 "미응답") + AI 피드백 자리.
 */
export function ReviewQuestionCard({ question, isSpeaking, onPlayQuestion }: ReviewQuestionCardProps) {
  const slotLabel = getBlueprintSlot(question.slot_no)?.label ?? question.function;

  return (
    <li className="rounded-2xl border-2 border-slate-100 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
          {question.slot_no}번
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{slotLabel}</span>
        <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-400">
          {question.topic}
        </span>
      </div>

      <p className="mt-3 text-base font-bold leading-relaxed text-slate-800">{question.text_en}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{question.text_ko}</p>

      <button
        type="button"
        onClick={onPlayQuestion}
        disabled={isSpeaking}
        className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-emerald-500 px-4 py-2 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
      >
        {isSpeaking ? "재생 중..." : "문제 다시 듣기"}
      </button>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="text-xs font-bold text-slate-400">내 답변</p>
        {question.recording ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption -- 본인이 녹음한 답변 재생
          <audio className="mt-2 w-full" controls src={question.recording.url} />
        ) : (
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-400">미응답</p>
        )}
      </div>

      <div className="mt-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center">
        <p className="text-xs font-semibold text-slate-400">AI 피드백 (준비 중)</p>
      </div>
    </li>
  );
}
