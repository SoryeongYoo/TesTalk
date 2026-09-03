"use server";

import type { GenerateTestSetResult } from "@/lib/server/generateTestSet";
import { generateTestSet as generateTestSetImpl } from "@/lib/server/generateTestSet";
import type { OpicDifficultyLevel } from "@testalk/shared";

/**
 * Server Action 진입점. 실제 로직은 lib/server/generateTestSet.ts에 있고
 * (직접 임포트해서 스크립트/테스트에서 재사용 가능), 이 파일은 UI에서 호출할
 * "use server" 경계만 얇게 감싼다. ANTHROPIC_API_KEY는 이 서버 코드에서만 읽힌다.
 */
export async function generateTestSet(
  surveyTopics: string[],
  difficulty: OpicDifficultyLevel,
): Promise<GenerateTestSetResult> {
  return generateTestSetImpl(surveyTopics, difficulty);
}
