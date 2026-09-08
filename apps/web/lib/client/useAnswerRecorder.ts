"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupportedRecordingMimeType, isMediaRecordingSupported } from "./recording";

export type RecordingStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "stopped"
  | "unsupported"
  | "error";

export interface AnswerRecording {
  url: string;
  mimeType: string;
  durationSeconds: number;
}

interface UseAnswerRecorderResult {
  status: RecordingStatus;
  /** 마이크 권한 거부/장치 없음 등 사용자에게 보여줄 안내 메시지. */
  errorMessage: string | null;
  /** 녹음 중 카운트업 표시용 경과 초. */
  recordingSeconds: number;
  /** 가장 최근에 완료된 녹음. 문항이 바뀌면 reset()으로 비워진다 — 영구 보관은 호출부(페이지) 책임. */
  recording: AnswerRecording | null;
  start: () => Promise<void>;
  stop: () => void;
  /** 문항 전환 시 호출 — 진행 중인 녹음/스트림/타이머를 정리하고 idle로 되돌린다. */
  reset: () => void;
}

/**
 * 문항 하나에 대한 답변 녹음을 관리하는 훅.
 *
 * - 녹음마다 새 getUserMedia 스트림을 요청하고, 정지 즉시 트랙을 꺼서 브라우저의
 *   마이크 사용 표시가 문항 사이에 계속 켜져 있지 않게 한다.
 * - 완료된 녹음의 Blob URL 수명(revoke 시점)은 이 훅이 아니라 호출부가 관리한다 —
 *   페이지가 문항별 Map에 복사해 보관하므로, 여기서 먼저 해제하면 재생이 끊긴다.
 */
export function useAnswerRecorder(): UseAnswerRecorderResult {
  const [status, setStatus] = useState<RecordingStatus>(
    isMediaRecordingSupported() ? "idle" : "unsupported",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recording, setRecording] = useState<AnswerRecording | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);

  const clearTick = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!isMediaRecordingSupported()) {
      setStatus("unsupported");
      return;
    }

    setErrorMessage(null);
    setStatus("requesting");
    setRecording(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const durationSeconds = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        setRecording({ url: URL.createObjectURL(blob), mimeType: blob.type, durationSeconds });
        clearTick();
        releaseStream();
        setStatus("stopped");
      };
      recorder.onerror = () => {
        setErrorMessage("녹음 중 오류가 발생했어요. 다시 시도해주세요.");
        clearTick();
        releaseStream();
        setStatus("error");
      };

      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setRecordingSeconds(0);
      recorder.start();

      clearTick();
      intervalRef.current = setInterval(() => {
        setRecordingSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 1000);
      setStatus("recording");
    } catch (err) {
      releaseStream();
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
        setErrorMessage("마이크 권한이 거부됐어요. 브라우저 주소창 옆 설정에서 마이크 권한을 허용한 뒤 다시 시도해주세요.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setErrorMessage("마이크를 찾을 수 없어요. 마이크가 연결되어 있는지 확인해주세요.");
      } else {
        setErrorMessage("마이크에 접근할 수 없어요. 잠시 후 다시 시도해주세요.");
      }
      setStatus("error");
    }
  }, [clearTick, releaseStream]);

  const stop = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  const reset = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      // 저장하지 않고 버린다 — onstop이 호출되긴 하지만 청크를 비워뒀으니 빈 Blob이 생겨도 무해하다.
      recorder.onstop = null;
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    clearTick();
    releaseStream();
    setRecording(null);
    setRecordingSeconds(0);
    setErrorMessage(null);
    setStatus(isMediaRecordingSupported() ? "idle" : "unsupported");
  }, [clearTick, releaseStream]);

  // 언마운트(문항 화면 이탈) 시 마이크 스트림/타이머가 남지 않도록 정리한다.
  useEffect(() => {
    return () => {
      clearTick();
      releaseStream();
    };
  }, [clearTick, releaseStream]);

  return { status, errorMessage, recordingSeconds, recording, start, stop, reset };
}
