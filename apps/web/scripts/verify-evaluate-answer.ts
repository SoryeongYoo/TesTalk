/**
 * evaluateAnswer()를 실제 Claude API로 한 번 호출해서 결과를 콘솔에 출력하고,
 * apps/web/scripts/last-feedback-output.txt에도 저장하는 확인용 스크립트.
 * UI 없이 서버 로직만 검증한다.
 *
 * 실행: pnpm verify:feedback (레포 루트에서)
 * (apps/web/.env.local에 ANTHROPIC_API_KEY가 있어야 한다 — .env.example 참고)
 */
import fs from "node:fs";
import path from "node:path";

const envLocalPath = path.resolve(__dirname, "..", ".env.local");
try {
  process.loadEnvFile(envLocalPath);
} catch (err) {
  console.warn(
    `[verify] ${envLocalPath} 를 불러오지 못했습니다 (${(err as Error).message}). ` +
      "이미 설정된 환경변수를 그대로 사용합니다.",
  );
}

// eslint-disable-next-line import/first -- ANTHROPIC_API_KEY를 읽기 전에 로드해야 하므로 import보다 loadEnvFile이 먼저다.
import { evaluateAnswer } from "../lib/server/evaluateAnswer";
import type { EvaluateAnswerQuestion } from "@testalk/shared";

const QUESTION: EvaluateAnswerQuestion = {
  function: "description",
  topic: "카페",
  text_en:
    "I'd like to know about a cafe you often go to. Where is it located and what does it look like? Describe it in as much detail as possible.",
};

const ANSWER_TEXT =
  "Well, there's a small cafe near my house that I go to almost every weekend. " +
  "It's located right next to the subway station, so it's really easy to get to. " +
  "The inside is pretty cozy, with wooden tables and a lot of plants near the window. " +
  "I usually sit by the window because I like watching people walk by while I drink my coffee.";

const OUTPUT_PATH = path.resolve(__dirname, "last-feedback-output.txt");

async function main() {
  console.log(`[verify] question=${JSON.stringify(QUESTION)}`);
  console.log(`[verify] answerText="${ANSWER_TEXT}"\n`);

  const feedback = await evaluateAnswer(QUESTION, ANSWER_TEXT);

  const report = JSON.stringify(feedback, null, 2);
  console.log("\n" + "=".repeat(100));
  console.log(report);
  console.log("=".repeat(100));

  fs.writeFileSync(OUTPUT_PATH, report + "\n", "utf-8");
  console.log(`\n[verify] 결과를 ${OUTPUT_PATH} 에 저장했습니다.`);
}

main().catch((err) => {
  console.error("\n[verify] 채점 실패:", err);
  process.exitCode = 1;
});
