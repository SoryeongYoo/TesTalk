import type { OpicFunction, OpicQuestion } from "@testalk/shared";

/**
 * 문항 유형(function)별 기본 권장 답변 시간(초).
 *
 * docs/PLAN.md 4-4는 AI 생성 스키마에 문항별 `answer_seconds`가 내려오는 것을 목표로
 * 하지만, packages/shared/src/schema.ts(OpicQuestionSchema)는 아직 이 필드를 정의하지
 * 않는다 — 값이 오면 그대로 쓰고(getRecommendedAnswerSeconds), 없으면 실제 오픽 진행
 * 시간을 참고한 유형별 기본값으로 대체한다.
 *
 * Record<OpicFunction, number>로 선언해 `blueprint.ts`의 OPIC_FUNCTIONS가 바뀌면
 * 타입 에러로 드러나게 한다 — 같은 enum을 별도로 나열하지 않는다(CLAUDE.md 규칙 5).
 */
const DEFAULT_ANSWER_SECONDS_BY_FUNCTION: Record<OpicFunction, number> = {
  intro: 60,
  description: 90,
  habit: 90,
  comparison: 90,
  past_experience: 90,
  roleplay_ask: 60,
  roleplay_solve: 60,
  roleplay_experience: 90,
  advanced_compare: 90,
  advanced_issue: 90,
};

/** 문항별 권장 답변 시간(초)을 반환한다. */
export function getRecommendedAnswerSeconds(question: OpicQuestion): number {
  const withTiming = question as OpicQuestion & { answer_seconds?: unknown };
  if (typeof withTiming.answer_seconds === "number" && withTiming.answer_seconds > 0) {
    return withTiming.answer_seconds;
  }
  return DEFAULT_ANSWER_SECONDS_BY_FUNCTION[question.function];
}
