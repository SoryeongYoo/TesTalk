"use client";

/**
 * 브라우저 Web Speech API(SpeechRecognition)를 감싼 아주 얇은 헬퍼.
 *
 * ⚠️ 브라우저 전용. 서버(Server Action/Route Handler)에서 import하지 않는다 —
 * `window`가 없다.
 *
 * SpeechRecognition은 TS 기본 lib.dom에 포함돼 있지 않거나(버전에 따라) 일부만 있어서,
 * 이 앱이 쓰는 최소한의 모양만 여기 선언한다. 전역 타입과 이름이 겹치지 않도록
 * `Browser*` 접두사를 붙였다.
 *
 * 지원 현황: Chrome/Edge(데스크톱·Android)는 `webkitSpeechRecognition`으로 지원,
 * Safari는 버전별로 불안정, Firefox는 미지원. Chrome 구현은 오디오를 Google 서버로
 * 보내 인식하므로 네트워크가 필요하다.
 */

export interface BrowserSpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

export interface BrowserSpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: BrowserSpeechRecognitionAlternative;
}

export interface BrowserSpeechRecognitionResultList {
  readonly length: number;
  [index: number]: BrowserSpeechRecognitionResult;
}

export interface BrowserSpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: BrowserSpeechRecognitionResultList;
}

export interface BrowserSpeechRecognitionErrorEvent extends Event {
  /** "no-speech" | "aborted" | "audio-capture" | "network" | "not-allowed" | "service-not-allowed" | ... */
  readonly error: string;
  readonly message: string;
}

export interface BrowserSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

interface WindowWithSpeechRecognition {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
}

/** 이 브라우저의 SpeechRecognition 생성자 (webkit 프리픽스 폴백). 미지원이면 null. */
export function getSpeechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as WindowWithSpeechRecognition;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** 이 브라우저가 음성 인식(SpeechRecognition)을 지원하는지. */
export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}
