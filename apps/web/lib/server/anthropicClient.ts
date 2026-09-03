import Anthropic from "@anthropic-ai/sdk";

/**
 * 서버 전용 Anthropic 클라이언트.
 *
 * ⚠️ 이 파일은 `apps/web/lib/server/` 아래에만 둔다. 이 디렉터리는 서버 코드
 * (Server Action, Route Handler)에서만 import해야 하며, "use client" 컴포넌트에서
 * 절대 import하지 않는다 — ANTHROPIC_API_KEY가 클라이언트 번들에 포함되면 안 된다.
 */

let cachedClient: Anthropic | null = null;

/** 프로세스당 클라이언트 하나만 만들어 재사용한다. */
export function getAnthropicClient(): Anthropic {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY 환경변수가 설정되어 있지 않습니다. " +
        "apps/web/.env.example을 apps/web/.env.local로 복사한 뒤 키를 채워 넣으세요.",
    );
  }

  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}
