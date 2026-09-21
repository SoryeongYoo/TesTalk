/**
 * 결제 없이 특정 사용자의 크레딧을 수동으로 충전하는 관리자 전용 스크립트.
 * 실제 충전 로직(addCredits)은 lib/server/credits.ts 하나뿐이고, 나중에 토스 결제
 * 성공 콜백이 이 스크립트 대신 addCredits()를 직접 호출하는 형태로 대체될 것이다.
 *
 * 실행: pnpm add-credits <email> <amount>  (레포 루트에서)
 * (apps/web/.env.local에 DATABASE_URL이 있어야 한다)
 */
import path from "node:path";

const envLocalPath = path.resolve(__dirname, "..", ".env.local");
try {
  process.loadEnvFile(envLocalPath);
} catch (err) {
  console.warn(
    `[add-credits] ${envLocalPath} 를 불러오지 못했습니다 (${(err as Error).message}). ` +
      "이미 설정된 환경변수를 그대로 사용합니다.",
  );
}

// eslint-disable-next-line import/first -- DATABASE_URL을 읽기 전에 로드해야 하므로 import보다 loadEnvFile이 먼저다.
import { eq } from "drizzle-orm";
import { addCredits } from "../lib/server/credits";
import { closeDb, getDb } from "../lib/server/db/client";
import { users } from "../lib/server/db/schema";

async function main() {
  const [email, amountRaw] = process.argv.slice(2);
  const amount = Number(amountRaw);

  if (!email || !amountRaw || !Number.isInteger(amount) || amount <= 0) {
    console.error("사용법: pnpm add-credits <email> <amount>");
    process.exitCode = 1;
    return;
  }

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) {
    console.error(
      `[add-credits] 이메일 "${email}" 로 가입한 사용자를 찾을 수 없습니다. ` +
        "(로그인을 한 번도 하지 않은 이메일이면 users 행이 없습니다.)",
    );
    process.exitCode = 1;
    await closeDb();
    return;
  }

  const newBalance = await addCredits(user.id, amount);
  console.log(`[add-credits] ${email} (${user.id}) 에 크레딧 ${amount}개 충전 완료. 현재 잔액: ${newBalance}개`);

  await closeDb();
}

main().catch(async (err) => {
  console.error("[add-credits] 실패:", err);
  await closeDb();
  process.exitCode = 1;
});
