import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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
