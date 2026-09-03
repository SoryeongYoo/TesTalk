/**
 * generateTestSet()을 실제 Claude API로 한 번 호출해서 결과를 콘솔에 출력하는 확인용 스크립트.
 * UI 없이 서버 로직만 검증한다.
 *
 * 실행: pnpm verify:generate (레포 루트에서)
 * (apps/web/.env.local에 ANTHROPIC_API_KEY가 있어야 한다 — .env.example 참고)
 */
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
import { generateTestSet } from "../lib/server/generateTestSet";

const SURVEY_TOPICS = ["여행", "음악", "자전거"];
const DIFFICULTY = 3;

async function main() {
  console.log(`[verify] surveyTopics=${JSON.stringify(SURVEY_TOPICS)}, difficulty=${DIFFICULTY}\n`);

  const result = await generateTestSet(SURVEY_TOPICS, DIFFICULTY);

  console.log("\n" + "=".repeat(100));
  console.log(`검증 결과: ${result.valid ? "PASS ✅" : "FAIL ❌"}  (라운드 ${result.rounds}/3, issues ${result.issues.length}건)`);
  console.log("=".repeat(100));

  for (const q of result.questions) {
    const head = `[${String(q.slot_no).padStart(2, " ")}] ${q.function.padEnd(20)} | ${q.source.padEnd(8)} | topic: ${q.topic}`;
    console.log(head);
    console.log(`      en: ${q.text_en}`);
  }

  console.log("\n" + "=".repeat(100));
  console.log(`총 ${result.questions.length}문항, valid=${result.valid}`);
  if (!result.valid) {
    console.log("issues:", JSON.stringify(result.issues, null, 2));
  }
}

main().catch((err) => {
  console.error("\n[verify] 생성 실패:", err);
  process.exitCode = 1;
});
