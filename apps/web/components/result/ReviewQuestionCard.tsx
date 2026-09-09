"use client";

import { useState } from "react";
import {
  getBlueprintSlot,
  OPIC_LEVELS,
  type AnswerFeedback,
  type ExamSessionQuestion,
} from "@testalk/shared";
import { evaluateAnswer } from "@/app/actions/evaluateAnswer";

interface ReviewQuestionCardProps {
  question: ExamSessionQuestion;
  isSpeaking: boolean;
  onPlayQuestion: () => void;
  /** 이 문항의 피드백을 새로 받았을 때 부모(ExamSession)에 반영하기 위한 콜백. */
  onFeedbackReceived: (feedback: AnswerFeedback) => void;
}

/**
 * 결과 화면(/result)에서 문항 하나를 되짚어보는 카드.
 * 문항 정보 + 문제 오디오 다시 듣기 + 내 녹음 재생(없으면 "미응답") + AI 피드백.
 *
 * ⚠️ STT 연결 전 임시 UI — 지금은 답변 텍스트를 직접 입력받아 evaluateAnswer()를
 * 호출한다. 나중에 녹음→STT가 붙으면 이 textarea 자리를 전사 결과로 대체하면 된다.
 */
export function ReviewQuestionCard({
  question,
  isSpeaking,
  onPlayQuestion,
  onFeedbackReceived,
}: ReviewQuestionCardProps) {
  const slotLabel = getBlueprintSlot(question.slot_no)?.label ?? question.function;

  const [answerText, setAnswerText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleGetFeedback() {
    const trimmed = answerText.trim();
    if (trimmed.length === 0) return;

    setStatus("loading");
    setErrorMessage("");
    try {
      const feedback = await evaluateAnswer(
        { function: question.function, topic: question.topic, text_en: question.text_en },
        trimmed,
      );
      onFeedbackReceived(feedback);
      setStatus("idle");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
      setStatus("error");
    }
  }

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

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="text-xs font-bold text-slate-400">AI 피드백</p>

        {question.feedback ? (
          <FeedbackResult feedback={question.feedback} />
        ) : (
          <div className="mt-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-400">
              녹음→STT 연결 전 임시 입력이에요. 영어 답변을 직접 입력하면 채점 피드백을 받아볼 수 있어요.
            </p>
            <textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              disabled={status === "loading"}
              placeholder="이 문항에 대한 영어 답변을 입력해보세요."
              rows={4}
              className="mt-2 w-full rounded-xl border-2 border-slate-200 p-3 text-sm text-slate-800 outline-none focus:border-emerald-400 disabled:bg-slate-100"
            />
            {status === "error" && (
              <p className="mt-2 whitespace-pre-wrap break-words text-xs font-medium text-red-500">
                {errorMessage}
              </p>
            )}
            <button
              type="button"
              onClick={handleGetFeedback}
              disabled={status === "loading" || answerText.trim().length === 0}
              className="mt-3 rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              {status === "loading" ? "채점 중..." : "피드백 받기"}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

const CRITERIA: { key: keyof Pick<
  AnswerFeedback,
  "task_completion" | "grammar" | "vocabulary" | "fluency_organization"
>; label: string }[] = [
  { key: "task_completion", label: "과제 달성" },
  { key: "grammar", label: "문법 정확성" },
  { key: "vocabulary", label: "어휘" },
  { key: "fluency_organization", label: "유창성/구성" },
];

/** 최고 등급(AH) 대비 이 답변의 estimated_level 위치 비율 — 진행바 표시용. */
function levelProgressRatio(level: AnswerFeedback["estimated_level"]): number {
  const index = OPIC_LEVELS.indexOf(level);
  return (index + 1) / OPIC_LEVELS.length;
}

function FeedbackResult({ feedback }: { feedback: AnswerFeedback }) {
  return (
    <div className="mt-2 flex flex-col gap-3 rounded-xl bg-emerald-50/60 p-4">
      <div className="flex flex-col gap-2">
        {CRITERIA.map(({ key, label }) => {
          const criterion = feedback[key];
          return (
            <div key={key}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-600">{label}</p>
                <p className="text-xs font-bold text-emerald-600">{criterion.score} / 5</p>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{criterion.comment}</p>
            </div>
          );
        })}
      </div>

      <div className="border-t border-emerald-100 pt-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-600">예상 레벨 기여도</p>
          <p className="text-xs font-bold text-emerald-700">{feedback.estimated_level}</p>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${levelProgressRatio(feedback.estimated_level) * 100}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{feedback.estimated_level_comment}</p>
      </div>

      <div className="border-t border-emerald-100 pt-3">
        <p className="text-xs font-bold text-slate-600">개선 제안</p>
        <ul className="mt-1 flex flex-col gap-1">
          {feedback.improvements.map((tip, i) => (
            <li key={i} className="text-xs leading-relaxed text-slate-500">
              · {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
