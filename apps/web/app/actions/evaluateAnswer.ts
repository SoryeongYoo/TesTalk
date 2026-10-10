"use server";

import { auth } from "@/auth";
import { evaluateGradedAnswer } from "@/lib/server/gradedExam";
import { UnauthorizedError } from "@/lib/server/errors";
import type { AnswerFeedback } from "@testalk/shared";

/**
 * Server Action 진입점. 인증 확인 + 채점 응시 인가를 거친 뒤 evaluateAnswer를 호출한다.
 * 실제 채점 로직은 lib/server/evaluateAnswer.ts, 응시 인가(문항별 1회)는
 * lib/server/gradedExam.ts에 있다 — 이 파일은 그 둘을 잇는 얇은 "use server" 경계일 뿐이다.
 *
 * 크레딧은 여기서 차감하지 않는다 — 채점 응시를 시작할 때(생성 시점) 1크레딧이 이미
 * 차감됐고, 그 응시의 15문항 피드백은 전부 그 1크레딧으로 커버된다. 무료 연습 시험은
 * examId가 없으므로 서버에서 거부된다.
 *
 * 채점 대상 문항은 클라이언트가 보낸 텍스트가 아니라 서버에 저장된 응시 문항(slotNo)으로 정한다.
 *
 * ⚠️ 새로운 화면/API 라우트에서 피드백이 필요해도 lib/server/evaluateAnswer를 직접 부르지 말고
 * 반드시 이 진입점(또는 evaluateGradedAnswer)을 거치게 한다 — 그래야 크레딧 게이트를
 * 우회할 방법이 없다.
 */
export async function evaluateAnswer(
  examId: string,
  slotNo: number,
  answerText: string,
): Promise<{ feedback: AnswerFeedback }> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }

  const feedback = await evaluateGradedAnswer(session.user.id, examId, slotNo, answerText);
  return { feedback };
}
