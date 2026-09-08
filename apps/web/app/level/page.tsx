"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  OPIC_DIFFICULTY_LEVELS,
  type OpicDifficultyLevel,
  type OpicQuestion,
} from "@testalk/shared";
import { generateTestSet } from "@/app/actions/generateTestSet";
import { loadSurveyTopics } from "@/lib/client/surveyTopicsStore";
import { saveExamQuestions } from "@/lib/client/examQuestionsStore";
import { LevelCard } from "@/components/level/LevelCard";
import { QuestionCard } from "@/components/level/QuestionCard";

/** 이 화면이 지금 보여주는 단계. */
type ViewState = "select" | "loading" | "result" | "error";

export default function LevelPage() {
  const router = useRouter();
  // null이면 아직 sessionStorage를 확인 중(첫 렌더 하이드레이션) — undefined와 구분해
  // "설문을 먼저 완료해주세요" 안내를 섣불리 보여주지 않는다.
  const [surveyTopics, setSurveyTopics] = useState<string[] | null | undefined>(undefined);
  const [selectedLevel, setSelectedLevel] = useState<OpicDifficultyLevel | null>(null);
  const [view, setView] = useState<ViewState>("select");
  const [questions, setQuestions] = useState<OpicQuestion[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setSurveyTopics(loadSurveyTopics());
  }, []);

  async function handleGenerate() {
    if (!selectedLevel || !surveyTopics) return;
    setView("loading");
    setErrorMessage("");
    try {
      const result = await generateTestSet(surveyTopics, selectedLevel);
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

  if (view === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 to-white p-6">
        <div className="w-full max-w-md rounded-3xl border-2 border-red-100 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-800">시험 생성에 실패했어요</h1>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-500">{errorMessage}</p>
          <button
            type="button"
            onClick={handleGenerate}
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
          <p className="mt-1 text-sm text-slate-500">녹음 기능은 아직 없어요 — 문항을 하나씩 확인만 할 수 있어요.</p>
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
                saveExamQuestions(questions, selectedLevel);
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
        <div className="mx-auto flex w-full max-w-lg items-center px-6 py-4">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={selectedLevel === null}
            className="flex-1 rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            시험 만들기
          </button>
        </div>
      </div>
    </main>
  );
}
