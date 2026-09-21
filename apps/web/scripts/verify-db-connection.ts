/**
 * RDS PostgreSQL 연결을 확인하는 스크립트.
 * 1) SELECT 1 로 ping
 * 2) users 테이블 행 수 조회
 *
 * 실행: pnpm verify:db (레포 루트에서)
 * (apps/web/.env.local에 DATABASE_URL이 있어야 한다 — .env.example 참고)
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

// eslint-disable-next-line import/first -- DATABASE_URL을 읽기 전에 로드해야 하므로 import보다 loadEnvFile이 먼저다.
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "../lib/server/db/client";
import { users } from "../lib/server/db/schema";

async function main() {
  const db = getDb();

  console.log("[verify] SELECT 1 ping...");
  await db.execute(sql`select 1`);
  console.log("[verify] ping 성공");

  const rows = await db.select().from(users);
  console.log(`[verify] users 테이블 행 수: ${rows.length}`);

  await closeDb();
  console.log("[verify] DB 연결 정상 종료");
}

main().catch(async (err) => {
  console.error("\n[verify] DB 연결 실패. 아래 에러 메시지를 그대로 확인하세요:\n");
  console.error(err);
  console.error(
    "\n[verify] 접속이 안 되면 다음을 확인하세요:\n" +
      "  - RDS 보안그룹 인바운드 규칙에 현재 IP(또는 실행 환경)가 허용되어 있는지\n" +
      "  - RDS가 퍼블릭 액세스 가능(Publicly accessible)인지, 아니면 VPN/베스천 호스트가 필요한지\n" +
      "  - DATABASE_URL의 host/port/user/pass/dbname이 정확한지\n" +
      "  - RDS가 SSL을 강제하는데 DATABASE_SSL=disable로 꺼버리지는 않았는지\n" +
      "  - 마이그레이션(pnpm db:migrate)을 아직 실행하지 않아 users 테이블이 없는 것은 아닌지\n",
  );
  await closeDb();
  process.exitCode = 1;
});
