import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * 서버 전용 Drizzle/Postgres 클라이언트.
 *
 * ⚠️ 이 파일은 `apps/web/lib/server/` 아래에만 둔다. 이 디렉터리는 서버 코드
 * (Server Action, Route Handler)에서만 import해야 하며, "use client" 컴포넌트에서
 * 절대 import하지 않는다 — DATABASE_URL이 클라이언트 번들에 포함되면 안 된다.
 *
 * AWS RDS는 기본적으로 SSL 접속을 요구하므로 기본값은 ssl: "require"다.
 * SSL이 없는 로컬 Postgres(Docker 등)로 개발할 때만 DATABASE_SSL=disable로 끈다.
 */

type Db = ReturnType<typeof drizzle<typeof schema>>;

// Next.js dev 서버의 Fast Refresh로 모듈이 재평가돼도 커넥션 풀이 새로 생기지
// 않도록 globalThis에 캐싱한다 (RDS 커넥션 고갈 방지).
const globalForDb = globalThis as unknown as {
  __testalkSql?: postgres.Sql;
  __testalkDb?: Db;
};

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL 환경변수가 설정되어 있지 않습니다. " +
        "apps/web/.env.example을 apps/web/.env.local로 복사한 뒤 값을 채워 넣으세요. " +
        "형식: postgresql://user:pass@host:5432/testalk",
    );
  }
  return url;
}

/** 프로세스당 커넥션 풀 하나만 만들어 재사용한다. */
export function getDb(): Db {
  if (globalForDb.__testalkDb) {
    return globalForDb.__testalkDb;
  }

  const sql = postgres(getDatabaseUrl(), {
    ssl: process.env.DATABASE_SSL === "disable" ? false : "require",
    max: 10,
  });
  const db = drizzle(sql, { schema });

  globalForDb.__testalkSql = sql;
  globalForDb.__testalkDb = db;
  return db;
}

/** 연결 테스트/스크립트 종료 시 풀을 정리한다. */
export async function closeDb(): Promise<void> {
  if (globalForDb.__testalkSql) {
    await globalForDb.__testalkSql.end();
    globalForDb.__testalkSql = undefined;
    globalForDb.__testalkDb = undefined;
  }
}
