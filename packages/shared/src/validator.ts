import { OPIC_BLUEPRINT } from "./blueprint";
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

  return { valid: issues.length === 0, issues };
}
