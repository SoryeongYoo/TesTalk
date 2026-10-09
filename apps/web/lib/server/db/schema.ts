import { date, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/**
 * users.id는 애플리케이션이 새로 발급하지 않고, Cognito의 sub(고유 ID)를
 * 그대로 PK로 사용한다 — 로그인 세션의 사용자 식별자와 DB 행을 1:1로 맞추기 위함.
 */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const credits = pgTable("credits", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * 사용자별 하루 문제 생성 횟수. (user_id, usage_date) 한 행이 그날의 카운터다.
 * usage_date는 KST 기준 날짜 — 앱 서버 시간대와 무관하게 DB에서 계산해 넣는다
 * (lib/server/generationLimit.ts). 날짜가 바뀌면 새 행이 생기므로 별도 리셋 작업이 없다.
 */
export const dailyGenerationUsage = pgTable(
  "daily_generation_usage",
  {
    // users FK를 일부러 걸지 않는다 — DB 연결 전에 발급된 세션처럼 users 행이 없는
    // 로그인 사용자도 있을 수 있는데, 그때 FK 위반으로 생성 자체가 500으로 깨지면 안 된다.
    // 카운터 행은 users 행 없이 남아도 무해하다.
    userId: text("user_id").notNull(),
    usageDate: date("usage_date").notNull(),
    count: integer("count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.usageDate] })],
);
