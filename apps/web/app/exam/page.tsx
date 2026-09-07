"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBlueprintSlot, type OpicQuestion } from "@testalk/shared";
import { loadExamQuestions, clearExamQuestions } from "@/lib/client/examQuestionsStore";
import { isSpeechSynthesisSupported, speak, cancelSpeech } from "@/lib/client/speech";
import { ProgressBar } from "@/components/common/ProgressBar";
import { ModeToggle, type ExamMode } from "@/components/exam/ModeToggle";
import { SpeakerControls } from "@/components/exam/SpeakerControls";

const MAX_PLAYS = 2;

export default function ExamPage() {
  const router = useRouter();
  // null이면 아직 sessionStorage를 확인 중(첫 렌더 하이드레이션) — undefined와 구분해
  // "생성된 문항이 없어요" 안내를 섣불리 보여주지 않는다.
  const [questions, setQuestions] = useState<OpicQuestion[] | null | undefined>(undefined);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<ExamMode>("study"); // 기본은 학습 모드(텍스트 보임).
  const [playCount, setPlayCount] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsUnsupported, setTtsUnsupported] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    setQuestions(loadExamQuestions());
  }, []);

  const current = questions ? questions[currentIndex] : undefined;
  const isLastQuestion = questions ? currentIndex === questions.length - 1 : false;

  // 문항 진입 시 text_en을 자동 재생한다. StrictMode(dev)에서 effect가 두 번 실행돼도
  // cleanup에서 cancelSpeech()로 앞선 재생을 끊어버리므로, 실제로 들리는 건 마지막
  // 실행 한 번뿐이다 — playCount도 누적이 아니라 1로 "설정"해 이중 실행에 안전하다.
  useEffect(() => {
    if (!current) return;

    if (!isSpeechSynthesisSupported()) {
      setTtsUnsupported(true);
      setPlayCount(0);
      return;
    }
    setTtsUnsupported(false);
    setPlayCount(1);
    setIsSpeaking(true);
    speak(current.text_en, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });

    return () => {
      cancelSpeech();
    };
    // current(문항)이 바뀔 때만 자동 재생한다 — mode 토글 등 다른 상태 변화로는 재생하지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  function handleReplay() {
    if (!current || isSpeaking || playCount >= MAX_PLAYS) return;
    setPlayCount((c) => c + 1);
    setIsSpeaking(true);
    speak(current.text_en, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }

  function handleNext() {
    if (!questions) return;
    cancelSpeech();
    if (isLastQuestion) {
      setFinished(true);
      return;
    }
    setCurrentIndex((i) => i + 1);
  }

  // /level을 거치지 않고 /exam으로 바로 들어온 경우 — 응시할 문항이 없다.
  if (questions === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 to-white p-6">
        <div className="w-full max-w-md rounded-3xl border-2 border-emerald-100 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-800">생성된 문항이 없어요</h1>
          <p className="mt-2 text-sm text-slate-500">난이도 선택에서 시험을 먼저 만들어주세요.</p>
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

  if (questions === undefined) {
    // sessionStorage 확인 중 — 깜빡임 방지용 빈 화면.
    return <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-white" />;
  }

  if (finished) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 to-white p-6">
        <div className="w-full max-w-md rounded-3xl border-2 border-emerald-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500">
            <svg viewBox="0 0 20 20" fill="none" className="h-8 w-8 text-white" aria-hidden="true">
              <path
                d="M4 10.5L8 14.5L16 6"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-800">15문항을 모두 들었어요!</h1>
          <p className="mt-1 text-sm text-slate-500">녹음·채점 기능은 다음 단계에서 만들 예정이에요.</p>
          <button
            type="button"
            onClick={() => {
              clearExamQuestions();
              router.push("/level");
            }}
            className="mt-8 rounded-full border-2 border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
          >
            새 시험 만들기
          </button>
        </div>
      </main>
    );
  }

  if (!current) {
    // questions.length === 0 등 방어적 케이스 — 정상 흐름에서는 나오지 않는다.
    return null;
  }

  const slotLabel = getBlueprintSlot(current.slot_no)?.label ?? current.function;

  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-emerald-50 to-white">
      <div className="flex w-full max-w-lg flex-1 flex-col px-6">
        <div className="pt-8">
          <ProgressBar current={currentIndex + 1} total={questions.length} />
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
              {current.slot_no}번
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {slotLabel}
            </span>
          </div>
          <ModeToggle mode={mode} onChange={setMode} />
        </div>

        <div className="mt-8 flex-1 pb-32">
          <SpeakerControls
            playCount={playCount}
            isSpeaking={isSpeaking}
            unsupported={ttsUnsupported}
            onReplay={handleReplay}
          />

          {mode === "study" ? (
            <div className="mt-6 rounded-2xl border-2 border-slate-100 bg-white p-5">
              <p className="text-lg font-bold leading-relaxed text-slate-800">{current.text_en}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">{current.text_ko}</p>
            </div>
          ) : (
            <div className="mt-6 flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-10 text-center">
              <p className="text-sm font-medium text-slate-400">
                실전 모드예요. 소리로만 문제를 듣고 답해보세요.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 w-full border-t border-emerald-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg items-center px-6 py-4">
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-600"
          >
            {isLastQuestion ? "완료" : "다음 문항"}
          </button>
        </div>
      </div>
    </main>
  );
}
