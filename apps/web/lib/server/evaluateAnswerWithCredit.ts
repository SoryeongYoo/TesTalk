import type { AnswerFeedback, EvaluateAnswerQuestion } from "@testalk/shared";
import { deductCredit, getCreditBalance, refundCredit } from "./credits";
import { InsufficientCreditsError } from "./errors";
import { evaluateAnswer } from "./evaluateAnswer";

/**
 * evaluateAnswer()를 크레딧 게이트로 감싼 얇은 래퍼.
 *
 * 1) 잔액 >= 1이면 원자적으로 1 차감 (deductCredit) — 실패하면 evaluateAnswer를
 *    아예 호출하지 않는다 (크레딧 없이는 API 비용이 나가지 않는다).
 * 2) 차감 성공 후 evaluateAnswer가 실패하면 사용자 보호를 위해 크레딧을 환불한다.
 *
 * 인증은 이 함수의 책임이 아니다 — 호출부(Server Action)가 이미 로그인 여부를 확인한
 * 뒤 신뢰 가능한 userId(Cognito sub)만 넘긴다는 전제다.
 */
export async function evaluateAnswerWithCredit(
  userId: string,
  question: EvaluateAnswerQuestion,
  answerText: string,
): Promise<{ feedback: AnswerFeedback; creditBalance: number }> {
  const deducted = await deductCredit(userId);
  if (!deducted) {
    throw new InsufficientCreditsError();
  }

  try {
    const feedback = await evaluateAnswer(question, answerText);
    const creditBalance = await getCreditBalance(userId);
    return { feedback, creditBalance };
  } catch (err) {
    await refundCredit(userId);
    throw err;
  }
}
