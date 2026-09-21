/**
 * Server Action에서 던지는 에러는 message가 그대로 클라이언트로 전달되지만
 * (Route Handler와 달리 Next.js가 이 메시지는 redact하지 않는다), 클래스 자체는
 * 직렬화 경계를 넘지 못하므로 클라이언트에서는 `instanceof`로 구분할 수 없다.
 * 그래서 message 자체를 사용자에게 그대로 보여줘도 되는 문구로 정한다.
 */
export class UnauthorizedError extends Error {
  constructor(message = "로그인이 필요합니다.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class InsufficientCreditsError extends Error {
  constructor(message = "크레딧이 부족합니다.") {
    super(message);
    this.name = "InsufficientCreditsError";
  }
}
