"use server";

import { auth } from "@/auth";
import { evaluateAnswerWithCredit } from "@/lib/server/evaluateAnswerWithCredit";
import { UnauthorizedError } from "@/lib/server/errors";
import type { AnswerFeedback, EvaluateAnswerQuestion } from "@testalk/shared";

/**
 * Server Action 진입점. 인증 확인 + 크레딧 게이트를 거친 뒤 evaluateAnswer를 호출한다.
 * 실제 채점 로직은 lib/server/evaluateAnswer.ts, 크레딧 차감/환불은
 * lib/server/evaluateAnswerWithCredit.ts에 있다 — 이 파일은 그 둘을 잇는 얇은
 * "use server" 경계일 뿐이다.
 *
 * ⚠️ 새로운 화면/API 라우트에서 피드백이 필요해도 evaluateAnswerImpl을 직접 부르지 말고
 * 반드시 이 진입점(또는 evaluateAnswerWithCredit)을 거치게 한다 — 그래야 크레딧 게이트를
 * 우회할 방법이 없다.
 */
export async function evaluateAnswer(
  question: EvaluateAnswerQuestion,
  answerText: string,
): Promise<{ feedback: AnswerFeedback; creditBalance: number }> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }

  return evaluateAnswerWithCredit(session.user.id, question, answerText);
}
