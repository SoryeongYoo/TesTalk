import type { Config } from "drizzle-kit";
import path from "node:path";

try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env.local"));
} catch {
  // .env.local이 없으면 이미 설정된 환경변수를 그대로 사용한다.
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL 환경변수가 설정되어 있지 않습니다. " +
      "apps/web/.env.example을 apps/web/.env.local로 복사한 뒤 값을 채워 넣으세요.",
  );
}

export default {
  schema: "./lib/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
} satisfies Config;
