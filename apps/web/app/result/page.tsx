"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AnswerFeedback, ExamSession } from "@testalk/shared";
import { loadExamSession, clearExamSession, saveExamSession } from "@/lib/client/examSessionStore";
import { loadExamQuestions } from "@/lib/client/examQuestionsStore";
import { isSpeechSynthesisSupported, speak, cancelSpeech } from "@/lib/client/speech";
import { ReviewQuestionCard } from "@/components/result/ReviewQuestionCard";

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}초`;
  return `${minutes}분 ${seconds.toString().padStart(2, "0")}초`;
}

export default function ResultPage() {
  const router = useRouter();
  // undefined면 아직 sessionStorage를 확인 중 — null(결과 없음)과 구분한다.
  const [session, setSession] = useState<ExamSession | null | undefined>(undefined);
  const [activeSpeakingSlot, setActiveSpeakingSlot] = useState<number | null>(null);

  // 언마운트 시(다시 풀기/새 시험 만들기/다른 페이지로 이동 등 어떤 경로든) 더 이상
  // 재생할 일이 없는 이 세션의 녹음 Blob URL을 정리한다. cleanup 클로저가 마운트 시점의
  // 낡은 session을 참조하지 않도록 ref로 최신 값을 따로 들고 있는다.
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    setSession(loadExamSession());
  }, []);

  useEffect(() => {
    return () => {
      cancelSpeech();
      sessionRef.current?.questions.forEach((q) => {
        if (q.recording) URL.revokeObjectURL(q.recording.url);
      });
    };
  }, []);

  // 문항 하나에 새 피드백이 도착하면 세션 state에 반영하고, 새로고침해도 남도록
  // sessionStorage에도 다시 저장한다 (다른 필드는 그대로 두고 이 문항만 교체).
  function handleFeedbackReceived(slotNo: number, feedback: AnswerFeedback) {
    setSession((prev) => {
      if (!prev) return prev;
      const next: ExamSession = {
        ...prev,
        questions: prev.questions.map((q) => (q.slot_no === slotNo ? { ...q, feedback } : q)),
      };
      saveExamSession(next);
      return next;
    });
  }

  function playQuestionAudio(slotNo: number, textEn: string) {
    if (!isSpeechSynthesisSupported()) return;
    setActiveSpeakingSlot(slotNo);
    speak(textEn, {
      onEnd: () => setActiveSpeakingSlot((s) => (s === slotNo ? null : s)),
      onError: () => setActiveSpeakingSlot((s) => (s === slotNo ? null : s)),
    });
  }

  function handleRetry() {
    // 같은 15문항으로 처음부터 다시 응시한다 — 새 ExamSession은 /exam 진입 시 새로
    // 만들어지므로, 여기선 이전 결과만 지운다.
    const setup = loadExamQuestions();
    clearExamSession();
    router.push(setup ? "/exam" : "/level");
  }

  function handleNewTest() {
    clearExamSession();
    router.push("/level");
  }

  if (session === undefined) {
    // sessionStorage 확인 중 — 깜빡임 방지용 빈 화면.
    return <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-white" />;
  }

  if (session === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 to-white p-6">
        <div className="w-full max-w-md rounded-3xl border-2 border-emerald-100 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-800">결과가 없어요</h1>
          <p className="mt-2 text-sm text-slate-500">아직 완료한 응시 기록이 없어요. 시험을 먼저 만들어보세요.</p>
          <button
            type="button"
            onClick={() => router.push("/level")}
            className="mt-6 rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-600"
          >
            난이도 선택하러 가기 →
          </button>
        </div>
      </main>
    );
  }

  const answeredCount = session.questions.filter((q) => q.recording).length;
  const totalCount = session.questions.length;
  const durationLabel = session.finishedAt
    ? formatDuration(new Date(session.finishedAt).getTime() - new Date(session.createdAt).getTime())
    : null;

  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-emerald-50 to-white">
      <div className="w-full max-w-2xl flex-1 px-6 pb-16 pt-8">
        <div className="rounded-3xl border-2 border-emerald-100 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-emerald-600">응시 완료</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-800">수고하셨어요! 🎉</h1>

          <div className="mt-4 flex flex-wrap gap-6">
            <div>
              <p className="text-xs font-semibold text-slate-400">응답한 문항</p>
              <p className="mt-0.5 text-lg font-bold text-slate-800">
                {answeredCount} / {totalCount}
              </p>
            </div>
            {durationLabel && (
              <div>
                <p className="text-xs font-semibold text-slate-400">총 소요 시간</p>
                <p className="mt-0.5 text-lg font-bold text-slate-800">{durationLabel}</p>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-600"
            >
              다시 풀기
            </button>
            <button
              type="button"
              onClick={handleNewTest}
              className="rounded-full border-2 border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
            >
              새 시험 만들기
            </button>
          </div>
        </div>

        <ul className="mt-6 flex flex-col gap-4">
          {session.questions.map((question) => (
            <ReviewQuestionCard
              key={question.slot_no}
              question={question}
              isSpeaking={activeSpeakingSlot === question.slot_no}
              onPlayQuestion={() => playQuestionAudio(question.slot_no, question.text_en)}
              onFeedbackReceived={(feedback) => handleFeedbackReceived(question.slot_no, feedback)}
            />
          ))}
        </ul>
      </div>
    </main>
  );
}
