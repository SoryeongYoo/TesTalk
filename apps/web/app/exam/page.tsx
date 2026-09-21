"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createExamSession, getBlueprintSlot, type ExamSession } from "@testalk/shared";
import { loadExamQuestions } from "@/lib/client/examQuestionsStore";
import { saveExamSession } from "@/lib/client/examSessionStore";
import { loadSurveyTopics } from "@/lib/client/surveyTopicsStore";
import { isSpeechSynthesisSupported, speak, cancelSpeech } from "@/lib/client/speech";
import { useAnswerRecorder } from "@/lib/client/useAnswerRecorder";
import { getRecommendedAnswerSeconds } from "@/lib/client/answerTiming";
import { ProgressBar } from "@/components/common/ProgressBar";
import { ModeToggle, type ExamMode } from "@/components/exam/ModeToggle";
import { SpeakerControls } from "@/components/exam/SpeakerControls";
import { RecordingControls } from "@/components/exam/RecordingControls";
import { AnswerTimer } from "@/components/exam/AnswerTimer";

const MAX_PLAYS = 2;
// 재생이 끝난 뒤 "다시 듣기"를 누를 수 있는 유예 시간(초). 이 시간 안에 누르지 않으면
// 재생 횟수가 남아있어도 더 이상 다시 들을 수 없다.
const REPLAY_WINDOW_SECONDS = 5;

export default function ExamPage() {
  const router = useRouter();
  // undefined면 아직 sessionStorage를 확인 중(첫 렌더 하이드레이션) — null(생성된 문항
  // 없음)과 구분해 "생성된 문항이 없어요" 안내를 섣불리 보여주지 않는다.
  //
  // 이 화면의 상태는 전부 하나의 ExamSession으로 모은다(문항 + 문항별 녹음). 녹음이
  // 끝날 때마다 session.questions[i].recording을 갱신하고, "완료" 시점에 이 객체를
  // 그대로 examSessionStore에 저장해 /result로 넘긴다 — 별도의 recordings 맵을 두지
  // 않아서 "녹음이 세션에 잘 반영됐는지" 헷갈릴 여지가 없다.
  const [session, setSession] = useState<ExamSession | null | undefined>(undefined);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<ExamMode>("study"); // 기본은 학습 모드(텍스트 보임).
  const [playCount, setPlayCount] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsUnsupported, setTtsUnsupported] = useState(false);

  // 문제 재생이 끝나야 녹음/답변 타이머가 시작된다.
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [answerElapsedSeconds, setAnswerElapsedSeconds] = useState(0);
  // "다시 듣기" 유예 시간 카운트다운. null이면 카운트다운 대상이 아님(재생 전이거나 이미 다시 들었음).
  const [replaySecondsLeft, setReplaySecondsLeft] = useState<number | null>(null);
  const recorder = useAnswerRecorder();

  useEffect(() => {
    const setup = loadExamQuestions();
    if (!setup) {
      setSession(null);
      return;
    }
    // surveyTopics는 이 화면에선 필수가 아니다(결과 화면에 참고용으로만 쓰임) —
    // 없어도 빈 배열로 진행한다.
    const surveyTopics = loadSurveyTopics() ?? [];
    setSession(createExamSession(setup.difficulty, surveyTopics, setup.questions));
  }, []);

  const current = session ? session.questions[currentIndex] : undefined;
  const isLastQuestion = session ? currentIndex === session.questions.length - 1 : false;

  // 문항 진입 시 text_en을 자동 재생한다. StrictMode(dev)에서 effect가 두 번 실행돼도
  // cleanup에서 cancelSpeech()로 앞선 재생을 끊어버리므로, 실제로 들리는 건 마지막
  // 실행 한 번뿐이다 — playCount도 누적이 아니라 1로 "설정"해 이중 실행에 안전하다.
  useEffect(() => {
    if (!current) return;

    // 새 문항 진입 — 이전 문항의 녹음 진행 상태/답변 타이머를 초기화한다.
    // (완료된 녹음은 이미 session.questions에 반영돼 있으므로 여기서 지워도 안전하다.)
    recorder.reset();
    setHasPlayedOnce(false);
    setAnswerElapsedSeconds(0);
    setReplaySecondsLeft(null);

    if (!isSpeechSynthesisSupported()) {
      setTtsUnsupported(true);
      setPlayCount(0);
      setHasPlayedOnce(true); // TTS가 없으면 곧바로 녹음 가능해야 한다.
      return;
    }
    setTtsUnsupported(false);
    setPlayCount(1);
    setIsSpeaking(true);
    speak(current.text_en, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => {
        setIsSpeaking(false);
        setHasPlayedOnce(true);
      },
      onError: () => {
        setIsSpeaking(false);
        setHasPlayedOnce(true);
      },
    });

    return () => {
      cancelSpeech();
    };
    // current(문항)이 바뀔 때만 자동 재생한다 — mode 토글 등 다른 상태 변화로는 재생하지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // 방금 완료된 녹음을 세션의 해당 문항에 반영한다. "다음 문항"은 녹음 중엔 막혀
  // 있으므로(nextDisabled), 이 effect가 돌 때 current는 항상 그 녹음이 속한 문항이다.
  useEffect(() => {
    if (!recorder.recording || !current) return;
    const slotNo = current.slot_no;
    const finishedRecording = recorder.recording;
    setSession((prev) => {
      if (!prev) return prev;
      const previous = prev.questions.find((q) => q.slot_no === slotNo)?.recording;
      // 같은 문항을 다시 녹음해 덮어쓰는 경우 — 더 이상 쓸 일 없는 이전 Blob은 해제한다.
      // (세션 전체를 떠날 때의 최종 녹음 정리는 /result 쪽 책임 — 여기선 "교체되는" 것만 정리한다.)
      if (previous && previous.url !== finishedRecording.url) {
        URL.revokeObjectURL(previous.url);
      }
      return {
        ...prev,
        questions: prev.questions.map((q) => (q.slot_no === slotNo ? { ...q, recording: finishedRecording } : q)),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.recording]);

  // 답변 타이머: 재생이 끝난 뒤부터 카운트업하고, (다시 듣기로) 재생 중엔 멈춘다.
  // 녹음을 정지하면 그 문항의 답변 시간으로 고정한다.
  useEffect(() => {
    if (!hasPlayedOnce || isSpeaking || recorder.status === "stopped") return;
    const id = setInterval(() => setAnswerElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [hasPlayedOnce, isSpeaking, recorder.status]);

  // "다시 듣기" 유예 시간(REPLAY_WINDOW_SECONDS)을 카운트다운한다. 재생이 막 끝났고
  // 아직 다시 듣기를 쓰지 않았을 때만 돈다 — 이미 다 썼으면(playCount>=MAX_PLAYS)
  // 카운트다운이 의미 없으니 바로 꺼둔다(0은 "시간 초과"와 헷갈리므로 null로 구분).
  useEffect(() => {
    if (!hasPlayedOnce || playCount >= MAX_PLAYS) {
      setReplaySecondsLeft(null);
      return;
    }
    setReplaySecondsLeft(REPLAY_WINDOW_SECONDS);
    const id = setInterval(() => {
      setReplaySecondsLeft((s) => (s !== null && s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [hasPlayedOnce, playCount]);

  function handleReplay() {
    if (
      !current ||
      isSpeaking ||
      playCount >= MAX_PLAYS ||
      recorder.status === "recording" ||
      replaySecondsLeft === 0
    ) {
      return;
    }
    setPlayCount((c) => c + 1);
    setIsSpeaking(true);
    speak(current.text_en, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }

  function handleNext() {
    if (!session || recorder.status === "recording") return;
    cancelSpeech();
    if (isLastQuestion) {
      // 완료된 세션을 결과 화면으로 넘긴다. 녹음 Blob URL의 소유권도 여기서 /result로
      // 함께 넘어가는 셈이라 — /exam은 이 URL들을 정리(revoke)하지 않는다. 언마운트
      // 시점에 지워버리면 방금 저장한 세션의 오디오가 /result에서 재생되지 않는다.
      saveExamSession({ ...session, finishedAt: new Date().toISOString() });
      router.push("/result");
      return;
    }
    setCurrentIndex((i) => i + 1);
  }

  // /level을 거치지 않고 /exam으로 바로 들어온 경우 — 응시할 문항이 없다.
  if (session === null) {
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

  if (session === undefined) {
    // sessionStorage 확인 중 — 깜빡임 방지용 빈 화면.
    return <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-white" />;
  }

  if (!current) {
    // questions.length === 0 등 방어적 케이스 — 정상 흐름에서는 나오지 않는다.
    return null;
  }

  const slotLabel = getBlueprintSlot(current.slot_no)?.label ?? current.function;
  const savedRecording = current.recording;
  // idle이어도 이전에 완료해둔 녹음이 있으면(향후 이전 문항으로 돌아오는 경우 대비) 완료 상태로 보여준다.
  const recordingStatus = recorder.status === "idle" && savedRecording ? "stopped" : recorder.status;
  const recordingSecondsDisplay =
    recorder.status === "recording" ? recorder.recordingSeconds : savedRecording?.durationSeconds ?? recorder.recordingSeconds;
  const audioUrl = savedRecording?.url ?? recorder.recording?.url ?? null;
  const recommendedSeconds = getRecommendedAnswerSeconds(current);
  const nextDisabled = recorder.status === "recording";

  const replayLocked = recorder.status === "recording" || replaySecondsLeft === 0;
  const replayHintText =
    recorder.status === "recording"
      ? "녹음 중엔 다시 듣기를 쓸 수 없어요"
      : replaySecondsLeft === 0
        ? "다시 듣기 시간이 지났어요"
        : replaySecondsLeft !== null
          ? `다시 듣기 가능 · ${replaySecondsLeft}초 남음`
          : undefined;

  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-emerald-50 to-white">
      <div className="flex w-full max-w-lg flex-1 flex-col px-6">
        <div className="pt-8">
          <ProgressBar current={currentIndex + 1} total={session.questions.length} />
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
            replayLocked={replayLocked}
            hintText={replayHintText}
          />

          <RecordingControls
            enabled={hasPlayedOnce && !isSpeaking}
            status={recordingStatus}
            recordingSeconds={recordingSecondsDisplay}
            errorMessage={recorder.errorMessage}
            audioUrl={audioUrl}
            onStart={recorder.start}
            onStop={recorder.stop}
          />

          <AnswerTimer
            active={hasPlayedOnce && !isSpeaking && recorder.status !== "stopped"}
            elapsedSeconds={answerElapsedSeconds}
            recommendedSeconds={recommendedSeconds}
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
        <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-2 px-6 py-4">
          <button
            type="button"
            onClick={handleNext}
            disabled={nextDisabled}
            className="w-full rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {isLastQuestion ? "완료" : "다음 문항"}
          </button>
          {nextDisabled && (
            <p className="text-xs font-medium text-slate-400">녹음을 정지하면 다음 문항으로 넘어갈 수 있어요</p>
          )}
        </div>
      </div>
    </main>
  );
}
