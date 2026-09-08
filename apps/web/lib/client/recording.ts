"use client";

/**
 * 브라우저 MediaRecorder API 지원 여부/포맷을 감싼 아주 얇은 헬퍼.
 *
 * ⚠️ 브라우저 전용. 서버(Server Action/Route Handler)에서 import하지 않는다 —
 * `navigator`/`window`가 없다.
 *
 * MediaRecorder가 지원하는 mimeType은 브라우저마다 다르다(Chrome/Firefox는 webm,
 * Safari는 mp4 계열만 지원하는 식). `MediaRecorder.isTypeSupported()`로 우선순위대로
 * 확인해서 이 브라우저가 실제로 녹음 가능한 포맷을 고른다 — 아무것도 안 맞으면 빈
 * 문자열을 돌려주고, 호출부는 MediaRecorder 생성 시 options 없이(브라우저 기본값)
 * 생성한다.
 */
const CANDIDATE_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

/** 이 브라우저가 답변 녹음(getUserMedia + MediaRecorder)을 지원하는지. */
export function isMediaRecordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof window.MediaRecorder !== "undefined"
  );
}

/** 이 브라우저가 지원하는 녹음 포맷 중 우선순위가 가장 높은 것. 없으면 빈 문자열. */
export function getSupportedRecordingMimeType(): string {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") {
    return "";
  }
  return CANDIDATE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}
