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

/** 무료 연습 시험(또는 남의/존재하지 않는 응시)으로 피드백을 요청한 경우. */
export class FeedbackLockedError extends Error {
  constructor(message = "피드백은 크레딧으로 채점 응시한 시험에서만 받을 수 있어요.") {
    super(message);
    this.name = "FeedbackLockedError";
  }
}

/** 같은 채점 응시의 같은 문항에 대해 피드백을 이미 받은 경우 (응시당 문항별 1회). */
export class FeedbackAlreadyUsedError extends Error {
  constructor(message = "이 문항은 이미 피드백을 받았어요.") {
    super(message);
    this.name = "FeedbackAlreadyUsedError";
  }
}

export class DailyGenerationLimitError extends Error {
  constructor(
    readonly limit: number,
    message = "오늘 무료 생성 횟수를 다 썼어요.",
  ) {
    super(message);
    this.name = "DailyGenerationLimitError";
  }
}
