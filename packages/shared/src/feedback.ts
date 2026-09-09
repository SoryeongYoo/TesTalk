import { z } from "zod";
import type { OpicFunction } from "./blueprint";

/**
 * "답변 텍스트 → 평가" 피드백 엔진의 출력 스키마.
 * (참고: docs/PLAN.md 8. Phase 3 "STT + AI 피드백/루브릭 채점")
 *
 * docs/PLAN.md에는 채점 세부 루브릭이 정의되어 있지 않아, 표준 ACTFL 기준을 따른다:
 * OPIc 등급은 낮은 순으로 NL < NM < NH < IL < IM1 < IM2 < IM3 < IH < AL < AH.
 *
 * 이 파일은 OpicQuestionSchema(schema.ts)와 별개의 관심사(문항이 아니라 "채점 결과")라
 * schema.ts에 합치지 않고 독립 파일로 둔다 — blueprint.ts/survey.ts처럼 shared 내
 * 모듈 단위 분리 패턴을 따른다 (index.ts에서 함께 export).
 */

/** OPIc 등급 척도. 배열 순서가 곧 등급 순서(낮은→높은)다. */
export const OPIC_LEVELS = [
  "NL",
  "NM",
  "NH",
  "IL",
  "IM1",
  "IM2",
  "IM3",
  "IH",
  "AL",
  "AH",
] as const;

export type OpicLevel = (typeof OPIC_LEVELS)[number];

/** 채점 항목 하나: 오픽 루브릭 4개 축(과제 달성/문법/어휘/유창성) 공통 형태. */
export const FeedbackCriterionSchema = z.object({
  /** 1(미흡)~5(우수) 정수 점수. */
  score: z.number().int().min(1).max(5),
  /** 이 점수를 준 근거를 답변 내용에 근거해 짧게 설명. */
  comment: z.string().min(1),
});

export type FeedbackCriterion = z.infer<typeof FeedbackCriterionSchema>;

/**
 * evaluateAnswer()의 최종 출력. AI 응답은 반드시 이 스키마로 검증한 뒤에만
 * 사용자에게 노출한다 (CLAUDE.md 규칙 4의 validator 원칙을 피드백에도 그대로 적용).
 */
export const AnswerFeedbackSchema = z.object({
  /** 과제 달성 — 질문이 요구한 내용에 제대로 답했는가. */
  task_completion: FeedbackCriterionSchema,
  /** 문법 정확성. */
  grammar: FeedbackCriterionSchema,
  /** 어휘 다양성/적절성. */
  vocabulary: FeedbackCriterionSchema,
  /** 유창성/구성 — 문장 연결과 답변의 논리적 구성. */
  fluency_organization: FeedbackCriterionSchema,
  /** 개선 제안 1~2개. */
  improvements: z.array(z.string().min(1)).min(1).max(2),
  /** 이 답변 하나로 추정한 예상 OPIc 등급 기여도. */
  estimated_level: z.enum(OPIC_LEVELS),
  /** estimated_level을 그렇게 판단한 짧은 근거. */
  estimated_level_comment: z.string().min(1),
});

export type AnswerFeedback = z.infer<typeof AnswerFeedbackSchema>;

/**
 * evaluateAnswer()가 채점 대상 문항에서 실제로 필요로 하는 필드만 뽑은 타입.
 * OpicQuestion 전체(slot_no, source 등)는 채점 프롬프트와 무관해 요구하지 않는다.
 */
export interface EvaluateAnswerQuestion {
  function: OpicFunction;
  topic: string;
  text_en: string;
}
