import type { OpicDifficultyLevel } from "./difficulty";
import type { OpicQuestion } from "./schema";

/**
 * 문항 하나에 대한 답변 녹음을 재생하기 위한 참조.
 *
 * 실제 오디오 바이너리(Blob)는 여기 담기지 않는다 — 지금은 브라우저 메모리에 있는
 * Blob URL(`URL.createObjectURL`) 문자열만 들고 있다가, 나중에 서버 업로드가 붙으면
 * 이 `url`을 실제 저장소 URL로 교체하기만 하면 되도록 설계했다.
 */
export interface AnswerRecordingRef {
  url: string;
  mimeType: string;
  durationSeconds: number;
}

/**
 * AI 채점 피드백. 다음 단계(피드백 파이프라인)에서 구체적인 필드가 정해진다 — 지금은
 * 자리만 잡아둔 placeholder라 내용이 없다. 채워지기 시작하면 이 자리에 필드를 추가한다.
 */
export type AnswerFeedback = Record<string, never>;

/** 세션 안의 문항 하나 — blueprint 문항 원본 + 이 사용자의 녹음(있다면) + AI 피드백(있다면). */
export interface ExamSessionQuestion extends OpicQuestion {
  recording?: AnswerRecordingRef;
  feedback?: AnswerFeedback;
}

/**
 * 응시 한 회차(15문항)의 전체 결과.
 *
 * ⚠️ 서버 저장/계정 연동 전까지는 브라우저 세션 메모리에만 존재한다 — 특히
 * `recording.url`(Blob URL)은 새로고침하면 무효화되므로, 이 타입 전체를 "새로고침하면
 * 사라져도 괜찮은" 임시 상태로 다룬다. 서버 저장이 붙으면 이 타입 위에 얹어서 확장한다.
 */
export interface ExamSession {
  id: string;
  difficulty: OpicDifficultyLevel;
  surveyTopics: string[];
  /** 세션 생성 시각 (ISO 8601). */
  createdAt: string;
  /** 15문항을 모두 마친 시각 (ISO 8601). 진행 중이면 아직 없다. */
  finishedAt?: string;
  questions: ExamSessionQuestion[];
}

/**
 * 세션 식별자. 서버 저장 전까지는 화면에서 구분용으로만 쓰는 값이라
 * `crypto.randomUUID` 수준의 강한 유일성이 필요 없다 — 있으면 쓰고, 없으면
 * (구식 브라우저 등) 타임스탬프+난수로 대체한다.
 */
function generateSessionId(): string {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 새로 생성된 문항 세트로 빈 ExamSession을 만든다 — recording/feedback은 전부 비어있다. */
export function createExamSession(
  difficulty: OpicDifficultyLevel,
  surveyTopics: readonly string[],
  questions: readonly OpicQuestion[],
): ExamSession {
  return {
    id: generateSessionId(),
    difficulty,
    surveyTopics: [...surveyTopics],
    createdAt: new Date().toISOString(),
    questions: questions.map((q) => ({ ...q })),
  };
}
