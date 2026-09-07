"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SURVEY_CATEGORIES,
  SURVEY_POOL_TOTAL_REQUIRED,
  collectSurveyTopicPool,
  getSurveyPoolStatus,
  isCategorySatisfied,
  isPoolCategory,
  toggleSurveyOption,
  type SurveyOption,
  type SurveySelectionType,
  type SurveySelections,
} from "@testalk/shared";
import { ProgressBar } from "@/components/common/ProgressBar";
import { OptionCard } from "@/components/survey/OptionCard";
import { saveSurveyTopics, clearSurveyTopics } from "@/lib/client/surveyTopicsStore";

/** categoryId(또는 후속 질문 id) -> 선택된 optionId 목록. single 파트는 최대 1개만 담긴다. */
type Selections = SurveySelections;

/** 화면에 실제로 렌더링되는 한 화면 단위. SURVEY_CATEGORIES의 파트 하나이거나, 그 파트의 후속 질문이다. */
interface SurveyStep {
  /** selections를 저장할 때 쓰는 key. 원본 category(또는 followUp category)의 id. */
  key: string;
  part: number;
  title: string;
  selectionType: SurveySelectionType;
  minSelect: number;
  options: readonly SurveyOption[];
  isFollowUp: boolean;
}

/**
 * SURVEY_CATEGORIES를 화면 스텝 목록으로 펼친다. 후속 질문(part2 "아니요" → 수강 이력)은
 * 트리거 옵션이 실제로 선택된 경우에만 목록에 끼워 넣는다 — 선택이 바뀌면 다시 계산된다.
 */
function buildSteps(selections: Selections): SurveyStep[] {
  const steps: SurveyStep[] = [];
  for (const category of SURVEY_CATEGORIES) {
    steps.push({
      key: category.id,
      part: category.part,
      title: category.title,
      selectionType: category.selectionType,
      minSelect: category.minSelect,
      options: category.options,
      isFollowUp: false,
    });

    const followUp = category.followUp;
    if (followUp && (selections[category.id] ?? []).includes(followUp.triggerOptionId)) {
      steps.push({
        key: followUp.category.id,
        part: category.part,
        title: followUp.category.title,
        selectionType: followUp.category.selectionType,
        minSelect: followUp.category.minSelect,
        options: followUp.category.options,
        isFollowUp: true,
      });
    }
  }
  return steps;
}

export default function SurveyPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selections, setSelections] = useState<Selections>({});
  const [finished, setFinished] = useState(false);

  const steps = useMemo(() => buildSteps(selections), [selections]);
  // part2 답을 "아니요"→"예"로 바꿔 후속 스텝이 사라지는 경우를 대비한 안전장치.
  const currentIndex = Math.min(step, steps.length - 1);
  const current = steps[currentIndex]!;
  const isLastStep = currentIndex === steps.length - 1;
  const currentIsPool = isPoolCategory(current.key);

  const selectedIds = selections[current.key] ?? [];
  const selectedCount = selectedIds.length;
  const remaining = Math.max(0, current.minSelect - selectedCount);
  const ownStepSatisfied = isCategorySatisfied(current, selectedIds);

  // part4~7(여가/취미/운동/휴가·출장) 선택 합계 + 파트별 최소 개수를 종합한 상태.
  // "완료"는 마지막 스텝에서만 의미가 있지만, 뒤로 가서 앞 파트를 바꿀 수도 있으므로
  // 매 렌더마다 전체 선택 상태를 기준으로 다시 계산한다.
  const poolStatus = useMemo(
    () => getSurveyPoolStatus(selections, SURVEY_CATEGORIES),
    [selections],
  );

  // 마지막 스텝의 "완료"는 자기 파트 최소 개수 + part4~7 합계 12개 규칙을 모두 만족해야 한다.
  const canProceed = isLastStep ? ownStepSatisfied && poolStatus.canComplete : ownStepSatisfied;

  // part4~7 소속 파트에서 카드를 새로 선택하려는데 합계가 이미 12개면 막는다(해제는 항상 허용).
  const optionSelectionBlocked = currentIsPool && poolStatus.poolReached;

  function toggleOption(optionId: string) {
    setSelections((prev) => ({
      ...prev,
      [current.key]: toggleSurveyOption(
        prev[current.key] ?? [],
        { id: current.key, selectionType: current.selectionType },
        optionId,
        prev,
        SURVEY_CATEGORIES,
      ),
    }));
  }

  function handleNext() {
    if (!canProceed) return;
    if (isLastStep) {
      const surveyTopics = collectSurveyTopicPool(selections, SURVEY_CATEGORIES);
      // eslint-disable-next-line no-console
      console.log("surveyTopics", surveyTopics);
      saveSurveyTopics(surveyTopics);
      setFinished(true);
      return;
    }
    setStep(currentIndex + 1);
  }

  function handleBack() {
    setStep(Math.max(0, currentIndex - 1));
  }

  if (finished) {
    const surveyTopics = collectSurveyTopicPool(selections, SURVEY_CATEGORIES);
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 to-white p-6">
        <div className="w-full max-w-lg rounded-3xl border-2 border-emerald-100 bg-white p-8 text-center shadow-sm">
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
          <h1 className="text-xl font-bold text-slate-800">설문이 완료됐어요!</h1>
          <p className="mt-1 text-sm text-slate-500">
            선택한 주제 {surveyTopics.length}개가 콘솔에 출력됐어요.
          </p>
          <ul className="mt-5 flex flex-wrap justify-center gap-2">
            {surveyTopics.map((topic) => (
              <li
                key={topic}
                className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
              >
                {topic}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => router.push("/level")}
              className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-600"
            >
              난이도 선택하러 가기 →
            </button>
            <button
              type="button"
              onClick={() => {
                clearSurveyTopics();
                setStep(0);
                setSelections({});
                setFinished(false);
              }}
              className="rounded-full border-2 border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
            >
              다시 작성하기
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-emerald-50 to-white">
      <div className="flex w-full max-w-lg flex-1 flex-col px-6">
        <div className="pt-8">
          <ProgressBar current={currentIndex + 1} total={steps.length} />
        </div>

        <div className="mt-8 flex-1 pb-32">
          <p className="text-sm font-semibold text-emerald-600">
            Part {current.part}
            {current.isFollowUp ? " · 추가 질문" : ""}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-800">{current.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {current.selectionType === "single"
              ? "하나를 선택해주세요."
              : "해당하는 항목을 모두 선택해주세요."}
          </p>

          {current.selectionType === "multi" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                  ownStepSatisfied ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                최소 {current.minSelect}개 선택 · 현재 {selectedCount}개
              </p>
              {currentIsPool && (
                <p
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    poolStatus.poolReached ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  선택: {poolStatus.poolCount} / {SURVEY_POOL_TOTAL_REQUIRED}
                </p>
              )}
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {current.options.map((option) => {
              const isSelected = selectedIds.includes(option.id);
              return (
                <OptionCard
                  key={option.id}
                  label={option.label}
                  selected={isSelected}
                  shape={current.selectionType === "single" ? "single" : "multi"}
                  disabled={!isSelected && optionSelectionBlocked}
                  onClick={() => toggleOption(option.id)}
                />
              );
            })}
          </div>

          {!canProceed && (
            <p className="mt-4 text-sm font-medium text-amber-600">
              {!ownStepSatisfied
                ? current.selectionType === "single"
                  ? "선택지를 하나 골라야 다음으로 넘어갈 수 있어요."
                  : `최소 ${current.minSelect}개를 선택해야 다음으로 넘어갈 수 있어요. ${remaining}개 더 선택해주세요.`
                : poolStatus.unsatisfiedCategoryTitles.length > 0
                  ? `${poolStatus.unsatisfiedCategoryTitles.join(", ")} 파트에서 최소 2개를 선택해야 완료할 수 있어요.`
                  : `총 ${poolStatus.poolRemaining}개 더 선택해야 완료할 수 있어요.`}
            </p>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 w-full border-t border-emerald-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg items-center gap-3 px-6 py-4">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentIndex === 0}
            className="rounded-full border-2 border-slate-200 px-6 py-3 text-sm font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-0"
          >
            이전
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed}
            className="flex-1 rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            {isLastStep ? "완료" : "다음"}
          </button>
        </div>
      </div>
    </main>
  );
}
