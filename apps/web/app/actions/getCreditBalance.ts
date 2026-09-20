"use server";

import { auth } from "@/auth";
import { getCreditBalance as getCreditBalanceImpl } from "@/lib/server/credits";

/** 로그인한 사용자의 현재 크레딧 잔액. 비로그인이면 0을 돌려준다. */
export async function getCreditBalance(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;
  return getCreditBalanceImpl(session.user.id);
}
