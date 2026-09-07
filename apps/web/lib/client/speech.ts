"use client";

/**
 * 브라우저 Web SpeechSynthesis API를 감싼 아주 얇은 헬퍼.
 *
 * ⚠️ 브라우저 전용. 서버(Server Action/Route Handler)에서 import하지 않는다 —
 * `window`가 없다.
 *
 * voices 로딩 방어:
 * SpeechSynthesisVoice 목록은 특히 Chrome에서 비동기로 채워져서, 페이지 진입 직후
 * `getVoices()`가 빈 배열을 돌려주는 경우가 있다. 이 헬퍼는 `utterance.voice`를
 * 직접 지정하지 않고 `utterance.lang`만 설정한다 — 브라우저가 재생 시점에 알아서
 * 해당 언어에 맞는 음성을 고르므로, voices 목록이 아직 로딩되지 않은 상태에서도
 * 재생 자체는 막히지 않는다. 그래도 일부 브라우저는 voices를 한 번 조회해야
 * 엔진이 "깨어나는" 경우가 있어, 모듈 로드 시 getVoices()를 한 번 호출하고
 * onvoiceschanged가 오면 다시 호출해 목록을 미리 준비해둔다.
 */

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

export interface SpeakOptions {
  lang?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
}

/** 이 브라우저가 SpeechSynthesis를 지원하는지. */
export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * 텍스트를 읽는다. 이미 재생 중인 발화가 있으면 먼저 취소해서 겹쳐 재생되지 않게 한다.
 * 지원하지 않는 브라우저거나 재생 자체가 실패하면 예외를 던지지 않고 onError로만 알린다 —
 * 호출부(화면)는 재생 실패를 조용히 무시하지 않고 안내 문구를 보여줄 수 있다.
 */
export function speak(text: string, options: SpeakOptions = {}): void {
  if (!isSpeechSynthesisSupported()) {
    options.onError?.(new Error("이 브라우저는 음성 재생(SpeechSynthesis)을 지원하지 않습니다."));
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang ?? "en-US";
    utterance.onstart = () => options.onStart?.();
    utterance.onend = () => options.onEnd?.();
    utterance.onerror = (event) => options.onError?.(event);
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    options.onError?.(err);
  }
}

/** 재생 중인 발화를 즉시 멈춘다 (문항 이동, 언마운트 시 호출). */
export function cancelSpeech(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}
