/**
 * `drizzle-kit migrate` 대신 drizzle-orm의 migrate() API를 직접 호출한다.
 * `drizzle-kit migrate`는 진행 상태를 렌더링하는 hanji TUI를 사용하는데,
 * 비-TTY(CI, 자동화 셸) 환경에서 렌더링이 실패하면 실제 에러 메시지 없이
 * 조용히 exit code 1로 종료되는 알려진 문제가 있다. 이 스크립트는 그 문제를
 * 피하면서 동일한 ./drizzle 마이그레이션 폴더와 __drizzle_migrations 저널을 사용한다.
 *
 * 실행: pnpm db:migrate (레포 루트에서)
 */
import path from "node:path";

const envLocalPath = path.resolve(__dirname, "..", ".env.local");
try {
  process.loadEnvFile(envLocalPath);
} catch (err) {
  console.warn(
    `[migrate] ${envLocalPath} 를 불러오지 못했습니다 (${(err as Error).message}). ` +
      "이미 설정된 환경변수를 그대로 사용합니다.",
  );
}

// eslint-disable-next-line import/first -- DATABASE_URL을 읽기 전에 로드해야 하므로 import보다 loadEnvFile이 먼저다.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL 환경변수가 설정되어 있지 않습니다.");
  }

  const sql = postgres(url, {
    ssl: process.env.DATABASE_SSL === "disable" ? false : "require",
    max: 1,
  });
  const db = drizzle(sql);

  console.log("[migrate] 마이그레이션 적용 중...");
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "..", "drizzle") });
  console.log("[migrate] 마이그레이션 완료");

  await sql.end();
}

main().catch(async (err) => {
  console.error("\n[migrate] 마이그레이션 실패. 아래 에러 메시지를 그대로 확인하세요:\n");
  console.error(err);
  process.exitCode = 1;
});
