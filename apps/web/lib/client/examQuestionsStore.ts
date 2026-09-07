/**
 * 난이도 선택(/level)에서 생성한 15문항을 응시 화면(/exam)으로 넘기기 위한
 * sessionStorage 저장소. surveyTopicsStore.ts와 동일한 패턴 — 새로고침엔 살아남고
 * 탭을 닫으면 사라진다.
 *
 * ⚠️ 브라우저 전용. "use client" 컴포넌트에서만 import한다.
 */

import { OpicQuestionSetSchema, type OpicQuestion } from "@testalk/shared";

const STORAGE_KEY = "testalk:examQuestions";

/** 생성이 끝난 15문항을 저장한다. */
export function saveExamQuestions(questions: readonly OpicQuestion[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
  } catch {
    // 프라이빗 모드 등 — 조용히 무시. /exam에서 loadExamQuestions()가 null을 받아
    // "생성된 문항이 없어요" 안내로 처리한다.
  }
}

/**
 * 저장된 문항을 읽는다. 저장된 값이 없거나, 파싱에 실패하거나, 15문항 스키마를
 * 통과하지 못하면 null — shared의 OpicQuestionSetSchema가 유일한 검증 기준이다.
 */
export function loadExamQuestions(): OpicQuestion[] | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = OpicQuestionSetSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** 재생성하거나 처음부터 다시 시작할 때 이전 문항을 지운다. */
export function clearExamQuestions(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시.
  }
}
