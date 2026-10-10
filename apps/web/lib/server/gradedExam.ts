import { and, eq } from "drizzle-orm";
import { OpicQuestionSchema, type AnswerFeedback, type OpicDifficultyLevel } from "@testalk/shared";
import { deductCredit, getCreditBalance, refundCredit } from "./credits";
import { getDb } from "./db/client";
import { gradedExamFeedback, gradedExams } from "./db/schema";
import { FeedbackAlreadyUsedError, FeedbackLockedError, InsufficientCreditsError } from "./errors";
import { evaluateAnswer } from "./evaluateAnswer";
import { generateTestSet, type GenerateTestSetResult } from "./generateTestSet";

/**
 * ⚠️ 서버 전용. "채점 응시"(1크레딧 = 시험 생성 + 15문항 AI 피드백)의 유일한 경로.
 *
 * - 크레딧 차감은 응시 시작(생성) 시점에 딱 1번 — createGradedExam.
 * - 피드백은 graded_exams 행이 있는 응시에서만, 문항별 1번 — evaluateGradedAnswer.
 *   무료 연습 시험은 graded_exams 행이 없으므로 서버에서 피드백이 거부된다.
 *
 * 인증은 이 파일의 책임이 아니다 — 호출부(Server Action)가 로그인 여부를 확인한 뒤
 * 신뢰 가능한 userId(Cognito sub)만 넘긴다는 전제다.
 */

/**
 * 크레딧 1을 원자적으로 차감한 뒤 시험을 생성하고, 성공하면 채점 응시 행을 만든다.
 * 생성 실패(예외 또는 검증 미통과)나 행 저장 실패 시 차감한 크레딧을 반드시 환불한다.
 * 무료 일일 생성 한도와는 무관하다 (카운트하지도, 막히지도 않는다).
 */
export async function createGradedExam(
  userId: string,
  surveyTopics: readonly string[],
  difficulty: OpicDifficultyLevel,
): Promise<{ examId: string; result: GenerateTestSetResult; creditBalance: number }> {
  const deducted = await deductCredit(userId);
  if (!deducted) {
    throw new InsufficientCreditsError();
  }

  let examId: string;
  let result: GenerateTestSetResult;
  try {
    result = await generateTestSet(surveyTopics, difficulty);
    if (!result.valid) {
      // 검증 미통과 세트는 사용자에게 노출할 수 없으므로(CLAUDE.md §4) 생성 실패로 보고 환불한다.
      throw new Error(`검증을 통과하지 못했습니다 (issues ${result.issues.length}건). 다시 시도해주세요.`);
    }
    const db = getDb();
    const [row] = await db
      .insert(gradedExams)
      .values({ userId, questions: result.questions })
      .returning({ id: gradedExams.id });
    examId = row!.id;
  } catch (err) {
    await refundCredit(userId);
    console.log(`[gradedExam] 생성 실패로 크레딧 환불 — user=${userId}`);
    throw err;
  }

  console.log(`[gradedExam] 채점 응시 시작 — user=${userId}, exam=${examId}`);
  const creditBalance = await getCreditBalance(userId);
  return { examId, result, creditBalance };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 채점 응시의 문항 하나를 채점한다. 크레딧은 차감하지 않는다(응시 시작 때 이미 1 차감).
 *
 * 1) examId가 이 사용자의 채점 응시인지 확인 — 아니면 FeedbackLockedError (무료 연습 포함).
 * 2) 채점 대상 문항은 클라이언트 값이 아니라 DB에 저장된 문항에서 slotNo로 꺼낸다.
 * 3) (exam_id, slot_no)를 원자적으로 선점 — 이미 받은 문항이면 FeedbackAlreadyUsedError.
 * 4) AI 호출이 실패하면 선점을 풀어 같은 문항을 다시 요청할 수 있게 한다.
 */
export async function evaluateGradedAnswer(
  userId: string,
  examId: string,
  slotNo: number,
  answerText: string,
): Promise<AnswerFeedback> {
  if (!UUID_PATTERN.test(examId) || !Number.isInteger(slotNo)) {
    throw new FeedbackLockedError();
  }

  const db = getDb();
  const [exam] = await db
    .select({ questions: gradedExams.questions })
    .from(gradedExams)
    .where(and(eq(gradedExams.id, examId), eq(gradedExams.userId, userId)));
  if (!exam) {
    throw new FeedbackLockedError();
  }

  const question = OpicQuestionSchema.safeParse(exam.questions.find((q) => q.slot_no === slotNo));
  if (!question.success) {
    throw new FeedbackLockedError("이 응시에 없는 문항이에요.");
  }

  const claimed = await db
    .insert(gradedExamFeedback)
    .values({ examId, slotNo })
    .onConflictDoNothing()
    .returning({ slotNo: gradedExamFeedback.slotNo });
  if (claimed.length === 0) {
    throw new FeedbackAlreadyUsedError();
  }

  try {
    const { function: fn, topic, text_en } = question.data;
    return await evaluateAnswer({ function: fn, topic, text_en }, answerText);
  } catch (err) {
    await db
      .delete(gradedExamFeedback)
      .where(and(eq(gradedExamFeedback.examId, examId), eq(gradedExamFeedback.slotNo, slotNo)));
    throw err;
  }
}
