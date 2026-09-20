import { DEFAULT_SIGNUP_CREDITS } from "../credits";
import { getDb } from "./client";
import { credits, users } from "./schema";

/**
 * 로그인한 사용자를 users/credits 테이블에 upsert한다.
 * Cognito sub가 PK이므로 같은 사용자가 다시 로그인해도 새 행이 생기지 않고,
 * credits는 최초 로그인 시 DEFAULT_SIGNUP_CREDITS 잔액으로 한 번만 생성된다
 * (onConflictDoNothing이라 재로그인 시 잔액을 덮어쓰지 않는다).
 */
export async function upsertUserOnLogin(id: string, email: string): Promise<void> {
  const db = getDb();

  await db.insert(users).values({ id, email }).onConflictDoUpdate({
    target: users.id,
    set: { email },
  });

  await db.insert(credits).values({ userId: id, balance: DEFAULT_SIGNUP_CREDITS }).onConflictDoNothing({
    target: credits.userId,
  });
}
