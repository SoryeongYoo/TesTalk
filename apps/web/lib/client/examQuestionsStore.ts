/**
 * 난이도 선택(/level)에서 생성한 15문항 + 그때 고른 난이도를 응시 화면(/exam)으로
 * 넘기기 위한 sessionStorage 저장소. surveyTopicsStore.ts와 동일한 패턴 — 새로고침엔
 * 살아남고 탭을 닫으면 사라진다.
 *
 * 문항과 난이도를 하나로 묶어 저장하는 이유: 이 둘은 항상 함께 생성되고 항상 함께
 * 쓰인다(/exam이 ExamSession을 만들 때 둘 다 필요하다) — 따로 저장하면 한쪽만 갱신되고
 * 한쪽은 이전 값으로 남는 불일치가 생길 수 있다.
 *
 * ⚠️ 브라우저 전용. "use client" 컴포넌트에서만 import한다.
 */

import { OpicQuestionSetSchema, type OpicDifficultyLevel, type OpicQuestion } from "@testalk/shared";

const STORAGE_KEY = "testalk:examQuestions";

export interface ExamSetup {
  difficulty: OpicDifficultyLevel;
  questions: OpicQuestion[];
}

/** 생성이 끝난 15문항과 그때 고른 난이도를 저장한다. */
export function saveExamQuestions(questions: readonly OpicQuestion[], difficulty: OpicDifficultyLevel): void {
  try {
    const payload: ExamSetup = { difficulty, questions: [...questions] };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // 프라이빗 모드 등 — 조용히 무시. /exam에서 loadExamQuestions()가 null을 받아
    // "생성된 문항이 없어요" 안내로 처리한다.
  }
}

/**
 * 저장된 문항+난이도를 읽는다. 저장된 값이 없거나, 파싱에 실패하거나, 문항이 15문항
 * 스키마를 통과하지 못하거나, 난이도가 1~6 정수가 아니면 null — shared의
 * OpicQuestionSetSchema가 문항 쪽의 유일한 검증 기준이다.
 */
export function loadExamQuestions(): ExamSetup | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const { difficulty, questions } = parsed as Partial<ExamSetup>;
    if (typeof difficulty !== "number" || !Number.isInteger(difficulty) || difficulty < 1 || difficulty > 6) {
      return null;
    }
    const questionsResult = OpicQuestionSetSchema.safeParse(questions);
    if (!questionsResult.success) return null;

    return { difficulty: difficulty as OpicDifficultyLevel, questions: questionsResult.data };
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
