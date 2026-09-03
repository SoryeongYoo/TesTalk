import { z } from "zod";
import { OPIC_FUNCTIONS, OPIC_QUESTION_COUNT } from "./blueprint";

/** AI가 생성하는 문제의 유형(function). */
export const OpicFunctionSchema = z.enum(OPIC_FUNCTIONS);

/** 문제의 출처: 서베이(사전 설문) 기반인지, 서프라이즈(돌발) 문항인지. */
export const OpicSourceSchema = z.enum(["survey", "surprise"]);
export type OpicSource = z.infer<typeof OpicSourceSchema>;

/** AI가 생성하는 오픽 문제 1개의 스키마. */
export const OpicQuestionSchema = z.object({
  /** 1~15 사이의 문항 번호. */
  slot_no: z.number().int().min(1).max(OPIC_QUESTION_COUNT),
  /** 문항 유형. blueprint의 허용 유형과 일치해야 한다 (validator.ts 참고). */
  function: OpicFunctionSchema,
  /** 문항 주제 (예: "여행", "카페", "재활용"). */
  topic: z.string().min(1),
  /** 문항 출처. */
  source: OpicSourceSchema,
  /** 영문 문제 텍스트. */
  text_en: z.string().min(1),
  /** 국문(번역) 문제 텍스트. */
  text_ko: z.string().min(1),
});

export type OpicQuestion = z.infer<typeof OpicQuestionSchema>;

/** 15문항 전체 세트 스키마. */
export const OpicQuestionSetSchema = z
  .array(OpicQuestionSchema)
  .length(OPIC_QUESTION_COUNT);

export type OpicQuestionSet = z.infer<typeof OpicQuestionSetSchema>;
