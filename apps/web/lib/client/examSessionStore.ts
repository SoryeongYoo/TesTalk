/**
 * 응시(/exam)를 끝낸 ExamSession을 결과 화면(/result)으로 넘기기 위한 sessionStorage
 * 저장소. examQuestionsStore.ts와 같은 패턴 — 새로고침엔 살아남고 탭을 닫으면 사라진다.
 *
 * ⚠️ recording.url(Blob URL)은 브라우저 메모리에만 있는 참조라 새로고침하면 무효화된다
 * — 문항 텍스트 등은 새로고침 후에도 보이지만 오디오 재생은 깨질 수 있다는 뜻이다.
 * 지금 단계(서버 저장 전)에서는 의도된 동작이다.
 *
 * AI가 생성한 콘텐츠가 아니라 이 앱이 직접 만들고 다시 읽기만 하는 값이라
 * OpicQuestionSetSchema 같은 zod 검증은 붙이지 않았다 — 대신 읽을 때 최소한의
 * 구조만 방어적으로 확인한다.
 *
 * ⚠️ 브라우저 전용. "use client" 컴포넌트에서만 import한다.
 */

import type { ExamSession } from "@testalk/shared";

const STORAGE_KEY = "testalk:examSession";

/** 완료된(또는 진행 중인) 응시 세션을 저장한다. */
export function saveExamSession(session: ExamSession): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // 프라이빗 모드 등 — 조용히 무시. /result에서 loadExamSession()이 null을 받아
    // "결과가 없어요" 안내로 처리한다.
  }
}

/** 저장된 세션을 읽는다. 없거나, 파싱에 실패하거나, 최소 구조가 안 맞으면 null. */
export function loadExamSession(): ExamSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Partial<ExamSession>).id !== "string" ||
      typeof (parsed as Partial<ExamSession>).createdAt !== "string" ||
      !Array.isArray((parsed as Partial<ExamSession>).questions)
    ) {
      return null;
    }
    return parsed as ExamSession;
  } catch {
    return null;
  }
}

/** 결과를 보고 나서 재시도/새 시험으로 넘어갈 때 이전 세션을 지운다. */
export function clearExamSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시.
  }
}
