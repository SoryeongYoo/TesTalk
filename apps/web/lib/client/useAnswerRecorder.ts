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
  // start()는 getUserMedia를 await하는 동안 reset/언마운트/중복 start가 끼어들 수 있다.
  // 시도마다 번호를 올려서, await 이후 번호가 바뀌었으면 그 스트림은 버린다.
  const attemptRef = useRef(0);
  const busyRef = useRef(false);

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

  /** 진행 중인 recorder를 결과 저장 없이 버린다 (reset/언마운트용). */
  const discardRecorder = useCallback(() => {
    attemptRef.current += 1;
    busyRef.current = false;
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state !== "inactive") recorder.stop();
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    clearTick();
    releaseStream();
  }, [clearTick, releaseStream]);

  const start = useCallback(async () => {
    if (!isMediaRecordingSupported()) {
      setStatus("unsupported");
      return;
    }
    // 권한 요청 중이거나 이미 녹음 중이면 무시한다 — 더블클릭 시 스트림이 두 개 열려
    // 앞의 것이 해제되지 않고 마이크가 계속 켜져 있는 문제를 막는다.
    if (busyRef.current) return;
    busyRef.current = true;
    const attempt = ++attemptRef.current;

    setErrorMessage(null);
    setStatus("requesting");
    setRecording(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (attempt !== attemptRef.current) {
        // 권한 대기 중에 문항이 바뀌었거나 언마운트됨 — 이 스트림은 바로 닫는다.
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      const mimeType = getSupportedRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        busyRef.current = false;
        clearTick();
        releaseStream();
        const durationSeconds = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        chunksRef.current = [];
        if (blob.size === 0) {
          // 캡처된 데이터가 없으면 재생 불가능한 빈 녹음을 저장하지 않고 다시 녹음하도록 안내한다.
          setErrorMessage("녹음된 소리가 없어요. 마이크를 확인하고 다시 녹음해주세요.");
          setStatus("error");
          return;
        }
        setRecording({ url: URL.createObjectURL(blob), mimeType: blob.type, durationSeconds });
        setStatus("stopped");
      };
      recorder.onerror = () => {
        // 에러 뒤에 stop 이벤트가 이어서 오면 "녹음 완료"로 덮어쓰지 않도록 onstop을 뗀다.
        recorder.onstop = null;
        busyRef.current = false;
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
      if (attempt !== attemptRef.current) return; // 이미 reset/언마운트된 시도의 에러는 무시한다.
      busyRef.current = false;
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
    // 진행 중인 녹음은 저장하지 않고 버린다 (권한 요청 대기 중인 start도 무효화된다).
    discardRecorder();
    setRecording(null);
    setRecordingSeconds(0);
    setErrorMessage(null);
    setStatus(isMediaRecordingSupported() ? "idle" : "unsupported");
  }, [discardRecorder]);

  // 언마운트(문항 화면 이탈) 시 recorder/마이크 스트림/타이머가 남지 않도록 정리한다.
  // (완료된 녹음의 Blob URL은 호출부 소유라 여기서 revoke하지 않는다.)
  useEffect(() => {
    return () => {
      discardRecorder();
    };
  }, [discardRecorder]);

  return { status, errorMessage, recordingSeconds, recording, start, stop, reset };
}
