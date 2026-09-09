"use server";

import { evaluateAnswer as evaluateAnswerImpl } from "@/lib/server/evaluateAnswer";
import type { AnswerFeedback, EvaluateAnswerQuestion } from "@testalk/shared";

/**
 * Server Action 진입점. 실제 로직은 lib/server/evaluateAnswer.ts에 있고
 * (직접 임포트해서 스크립트/테스트에서 재사용 가능), 이 파일은 UI에서 호출할
 * "use server" 경계만 얇게 감싼다. ANTHROPIC_API_KEY는 이 서버 코드에서만 읽힌다.
 *
 * ⚠️ 유료화 대비 — 크레딧 게이트는 여기(호출부)가 아니라 lib/server/evaluateAnswer.ts의
 * evaluateAnswer() 자체를 감싸는 형태로 들어간다. 이 파일에 게이트 로직을 넣지 말 것 —
 * 나중에 다른 진입점(다른 화면/API 라우트)이 생기면 게이트를 또 붙여야 하기 때문이다.
 */
export async function evaluateAnswer(
  question: EvaluateAnswerQuestion,
  answerText: string,
): Promise<AnswerFeedback> {
  return evaluateAnswerImpl(question, answerText);
}
