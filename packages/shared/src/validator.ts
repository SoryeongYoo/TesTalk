import {
  OPIC_BLUEPRINT,
  TOPIC_CONSISTENT_GROUPS,
  type OpicGroup,
} from "./blueprint";
import { OpicQuestionSetSchema, type OpicQuestion } from "./schema";

export interface OpicValidationIssue {
  /** 문제가 발생한 문항 번호. 세트 구조 자체 오류(문항 개수 등)는 -1. */
  slotNo: number;
  message: string;
}

export interface OpicValidationResult {
  valid: boolean;
  issues: OpicValidationIssue[];
}

/**
 * AI가 생성한 문제 세트가 다음을 만족하는지 검사한다.
 *  1. Zod 스키마(schema.ts)를 통과하는가 (필드 타입, 15문항 개수 등)
 *  2. slot_no가 1~15 순서대로 정렬되어 있는가
 *  3. 각 슬롯의 function이 blueprint에서 허용하는 유형과 일치하는가
 *  4. 콤보1~3, 롤플레이처럼 한 주제를 이어 묻는 세트 안에서 topic이 모두 동일한가
 *
 * 스키마 검증에 실패하면 그 시점에서 issues를 반환하고 이후 순서/유형 검사는 하지 않는다.
 */
export function validateOpicQuestionSet(input: unknown): OpicValidationResult {
  const parsed = OpicQuestionSetSchema.safeParse(input);

  if (!parsed.success) {
    const issues: OpicValidationIssue[] = parsed.error.issues.map((issue) => {
      const firstPathSegment = issue.path[0];
      const slotNo =
        typeof firstPathSegment === "number"
          ? firstPathSegment + 1
          : -1;
      return {
        slotNo,
        message: `${issue.path.join(".") || "(root)"}: ${issue.message}`,
      };
    });
    return { valid: false, issues };
  }

  const questions: OpicQuestion[] = parsed.data;
  const issues: OpicValidationIssue[] = [];

  questions.forEach((question, index) => {
    const expectedSlotNo = index + 1;
    const blueprintSlot = OPIC_BLUEPRINT[index];

    if (question.slot_no !== expectedSlotNo) {
      issues.push({
        slotNo: expectedSlotNo,
        message: `slot_no 순서가 올바르지 않습니다. 예상: ${expectedSlotNo}, 실제: ${question.slot_no}`,
      });
    }

    if (blueprintSlot && !blueprintSlot.allowedFunctions.includes(question.function)) {
      issues.push({
        slotNo: expectedSlotNo,
        message: `function이 blueprint와 일치하지 않습니다. 허용: [${blueprintSlot.allowedFunctions.join(", ")}], 실제: ${question.function}`,
      });
    }
  });

  issues.push(...collectTopicConsistencyIssues(questions));

  return { valid: issues.length === 0, issues };
}

/**
 * 콤보1~3, 롤플레이 세트 안에서 topic이 흩어져 있는지 검사한다.
 * 세트의 첫 문항 topic을 기준으로 삼고, 다른 topic을 쓴 문항마다 issue를 남긴다.
 * topic 비교는 앞뒤 공백만 제거한 뒤 정확히 일치하는지 본다.
 */
function collectTopicConsistencyIssues(
  questions: OpicQuestion[],
): OpicValidationIssue[] {
  const issues: OpicValidationIssue[] = [];

  for (const group of TOPIC_CONSISTENT_GROUPS) {
    const slotNos = OPIC_BLUEPRINT.filter((slot) => slot.group === group).map(
      (slot) => slot.slotNo,
    );
    // blueprint 순서 = questions 인덱스 순서 (위에서 slot_no 순서를 이미 검사했다).
    const groupQuestions = slotNos
      .map((slotNo) => ({ slotNo, question: questions[slotNo - 1] }))
      .filter(
        (entry): entry is { slotNo: number; question: OpicQuestion } =>
          entry.question !== undefined,
      );

    if (groupQuestions.length === 0) continue;

    const expectedTopic = groupQuestions[0]!.question.topic.trim();

    for (const { slotNo, question } of groupQuestions.slice(1)) {
      if (question.topic.trim() !== expectedTopic) {
        issues.push({
          slotNo,
          message: `${groupLabel(group)} 세트의 topic이 일치하지 않습니다. 기준(${groupQuestions[0]!.slotNo}번): "${expectedTopic}", 실제: "${question.topic}"`,
        });
      }
    }
  }

  return issues;
}

const GROUP_LABELS: Record<OpicGroup, string> = {
  intro: "자기소개",
  combo1: "콤보1",
  combo2: "콤보2",
  combo3: "콤보3",
  roleplay: "롤플레이",
  advanced: "어드밴스",
};

function groupLabel(group: OpicGroup): string {
  return GROUP_LABELS[group];
}
