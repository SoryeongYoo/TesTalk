"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  OPIC_DIFFICULTY_LEVELS,
  type OpicDifficultyLevel,
  type OpicQuestion,
} from "@testalk/shared";
import { generateTestSet, type ExamMode } from "@/app/actions/generateTestSet";
import { getCreditBalance } from "@/app/actions/getCreditBalance";
import { signInToGenerate } from "@/app/actions/signIn";
import { loadSurveyTopics } from "@/lib/client/surveyTopicsStore";
import { saveExamQuestions } from "@/lib/client/examQuestionsStore";
import { LevelCard } from "@/components/level/LevelCard";
import { QuestionCard } from "@/components/level/QuestionCard";

/** 이 화면이 지금 보여주는 단계. */
/** login_required/limit_reached/credits_required는 생성 게이트에 막힌 상태 — Claude 호출 없이 바로 돌아온다. */
type ViewState = "select" | "loading" | "result" | "error" | "login_required" | "limit_reached" | "credits_required";

export default function LevelPage() {
  const router = useRouter();
  // null이면 아직 sessionStorage를 확인 중(첫 렌더 하이드레이션) — undefined와 구분해
  // "설문을 먼저 완료해주세요" 안내를 섣불리 보여주지 않는다.
  const [surveyTopics, setSurveyTopics] = useState<string[] | null | undefined>(undefined);
  const [selectedLevel, setSelectedLevel] = useState<OpicDifficultyLevel | null>(null);
  const [view, setView] = useState<ViewState>("select");
  const [questions, setQuestions] = useState<OpicQuestion[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  /** 오늘 생성 사용량. 생성 성공/한도 초과 응답에서 채워진다. */
  const [dailyUsage, setDailyUsage] = useState<{ used: number; limit: number } | null>(null);
  /** 마지막으로 요청한 응시 방식 — 에러 화면의 "다시 시도"가 같은 방식으로 재요청한다. */
  const [mode, setMode] = useState<ExamMode>("practice");
  /** 채점 응시면 서버가 발급한 응시 id — /exam → /result 피드백 인가에 쓰인다. */
  const [gradedExamId, setGradedExamId] = useState<string | undefined>(undefined);
  /** 크레딧 잔액. undefined면 아직 확인 중(비로그인이면 0). */
  const [creditBalance, setCreditBalance] = useState<number | undefined>(undefined);

  useEffect(() => {
    setSurveyTopics(loadSurveyTopics());
    getCreditBalance()
      .then(setCreditBalance)
      .catch(() => setCreditBalance(undefined));
  }, []);

  async function handleGenerate(requestedMode: ExamMode) {
    if (!selectedLevel || !surveyTopics) return;
    setMode(requestedMode);
    setView("loading");
    setErrorMessage("");
    try {
      const response = await generateTestSet(surveyTopics, selectedLevel, requestedMode);
      if (response.status === "login_required") {
        setView("login_required");
        return;
      }
      if (response.status === "daily_limit_reached") {
        setDailyUsage({ used: response.limit, limit: response.limit });
        setCreditBalance(response.creditBalance);
        // 무료 한도 소진 + 크레딧 0이면 생성 자체가 막힌다 — "크레딧이 필요합니다".
        setView(response.creditBalance > 0 ? "limit_reached" : "credits_required");
        return;
      }
      if (response.status === "insufficient_credits") {
        setCreditBalance(0);
        setView("credits_required");
        return;
      }
      const { result } = response;
      if (response.mode === "graded") {
        setGradedExamId(response.examId);
        setCreditBalance(response.creditBalance);
      } else {
        setGradedExamId(undefined);
        setDailyUsage({ used: response.used, limit: response.limit });
      }
      if (!result.valid) {
        throw new Error(
          `검증을 통과하지 못했습니다 (issues ${result.issues.length}건). 다시 시도해주세요.`,
        );
      }
      setQuestions(result.questions);
      setView("result");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
      setView("error");
    }
  }

  // 설문을 안 거치고 /level로 바로 들어온 경우 — 선택할 surveyTopics가 없다.
  if (surveyTopics === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 to-white p-6">
        <div className="w-full max-w-md rounded-3xl border-2 border-emerald-100 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-800">설문을 먼저 완료해주세요</h1>
          <p className="mt-2 text-sm text-slate-500">
            난이도를 선택하려면 배경설문에서 고른 주제가 필요해요.
          </p>
          <Link
            href="/survey"
            className="mt-6 inline-block rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-600"
          >
            설문 하러 가기 →
          </Link>
        </div>
      </main>
    );
  }

  if (surveyTopics === undefined) {
    // sessionStorage 확인 중 — 깜빡임 방지용 빈 화면.
    return <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-white" />;
  }

  if (view === "loading") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-b from-emerald-50 to-white p-6">
        <div
          className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-500"
          role="status"
          aria-label="시험 만드는 중"
        />
        <p className="text-base font-bold text-slate-800">시험 만드는 중...</p>
        <p className="text-sm text-slate-500">5개 세트를 동시에 생성하고 있어요. 몇 초 정도 걸려요.</p>
      </main>
    );
  }

  if (view === "login_required") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 to-white p-6">
        <div className="w-full max-w-md rounded-3xl border-2 border-emerald-100 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-800">로그인하고 시험을 만들어보세요</h1>
          <p className="mt-2 text-sm text-slate-500">
            AI 문제 생성은 로그인한 사용자만 이용할 수 있어요. 로그인하면 하루 몇 번씩 무료로
            새 시험을 만들 수 있어요.
          </p>
          <form action={signInToGenerate} className="mt-6">
            <button
              type="submit"
              className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-600"
            >
              로그인하기
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (view === "limit_reached") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 to-white p-6">
        <div className="w-full max-w-md rounded-3xl border-2 border-amber-100 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-800">오늘 무료 생성 횟수를 다 썼어요</h1>
          <p className="mt-2 text-sm text-slate-500">
            무료 연습 시험은 하루 {dailyUsage?.limit ?? 0}번까지 만들 수 있어요.
            <br />
            내일(한국 시간 자정 이후) 다시 만들거나, 크레딧으로 채점 응시할 수 있어요.
          </p>
          <button
            type="button"
            onClick={() => handleGenerate("graded")}
            className="mt-6 block w-full rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-600"
          >
            크레딧 1개로 채점 응시하기 (보유 {creditBalance ?? 0}개)
          </button>
          <Link
            href="/"
            className="mt-6 inline-block rounded-full border-2 border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
          >
            홈으로
          </Link>
        </div>
      </main>
    );
  }

  if (view === "credits_required") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 to-white p-6">
        <div className="w-full max-w-md rounded-3xl border-2 border-amber-100 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-800">크레딧이 필요합니다</h1>
          <p className="mt-2 text-sm text-slate-500">
            채점 응시(시험 생성 + 15문항 AI 피드백)에는 크레딧 1개가 필요해요.
            {dailyUsage && dailyUsage.used >= dailyUsage.limit && (
              <>
                <br />
                오늘 무료 연습 시험도 모두 사용했어요.
              </>
            )}
          </p>
          <Link
            href="/credits"
            className="mt-6 block w-full rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-600"
          >
            크레딧 충전하기
          </Link>
          <button
            type="button"
            onClick={() => setView("select")}
            className="mt-3 block w-full rounded-full border-2 border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
          >
            돌아가기
          </button>
        </div>
      </main>
    );
  }

  if (view === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 to-white p-6">
        <div className="w-full max-w-md rounded-3xl border-2 border-red-100 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-800">시험 생성에 실패했어요</h1>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-500">{errorMessage}</p>
          <button
            type="button"
            onClick={() => handleGenerate(mode)}
            className="mt-6 rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-600"
          >
            다시 시도
          </button>
        </div>
      </main>
    );
  }

  if (view === "result") {
    if (!selectedLevel) {
      // 방어적 케이스 — 생성 성공(handleGenerate)은 항상 selectedLevel이 있어야 일어난다.
      return null;
    }

    return (
      <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-emerald-50 to-white">
        <div className="w-full max-w-2xl flex-1 px-6 pb-32 pt-10">
          <h1 className="text-2xl font-bold text-slate-800">생성된 문항 {questions.length}개</h1>
          {mode === "graded" ? (
            <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              채점 응시 · 15문항 AI 피드백 포함 (남은 크레딧 {creditBalance ?? 0}개)
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-500">무료 연습 시험이에요 — 말하기 연습은 되지만 AI 피드백은 잠겨 있어요.</p>
          )}
          {mode === "practice" && dailyUsage && (
            <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              오늘 남은 무료 생성 {Math.max(dailyUsage.limit - dailyUsage.used, 0)}회
            </p>
          )}
          <ul className="mt-6 flex flex-col gap-3">
            {questions.map((question) => (
              <QuestionCard key={question.slot_no} question={question} />
            ))}
          </ul>
        </div>

        <div className="sticky bottom-0 w-full border-t border-emerald-100 bg-white/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-2xl items-center px-6 py-4">
            <button
              type="button"
              onClick={() => {
                saveExamQuestions(questions, selectedLevel, mode === "graded" ? gradedExamId : undefined);
                router.push("/exam");
              }}
              className="flex-1 rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-600"
            >
              응시 시작하기 →
            </button>
          </div>
        </div>
      </main>
    );
  }

  // view === "select"
  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-emerald-50 to-white">
      <div className="flex w-full max-w-lg flex-1 flex-col px-6">
        <div className="mt-8">
          <p className="text-sm font-semibold text-emerald-600">Self-Assessment</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-800">난이도를 선택해주세요</h1>
          <p className="mt-1 text-sm text-slate-500">평소 영어로 말할 수 있는 수준에 가까운 단계를 골라주세요.</p>
        </div>

        <div className="mt-6 flex flex-col gap-3 pb-32">
          {OPIC_DIFFICULTY_LEVELS.map((info) => (
            <LevelCard
              key={info.level}
              level={info.level}
              description={info.description}
              supported={info.supported}
              selected={selectedLevel === info.level}
              onClick={() => {
                if (!info.supported) return;
                setSelectedLevel(info.level);
              }}
            />
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 w-full border-t border-emerald-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2 px-6 py-4">
          <button
            type="button"
            onClick={() => handleGenerate("graded")}
            disabled={selectedLevel === null}
            className="w-full rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            채점 응시 · 크레딧 1개{creditBalance !== undefined ? ` (보유 ${creditBalance}개)` : ""}
          </button>
          <button
            type="button"
            onClick={() => handleGenerate("practice")}
            disabled={selectedLevel === null}
            className="w-full rounded-full border-2 border-emerald-500 px-6 py-2.5 text-sm font-bold text-emerald-600 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          >
            무료 연습 시험 만들기 (AI 피드백 없음)
          </button>
        </div>
      </div>
    </main>
  );
}
