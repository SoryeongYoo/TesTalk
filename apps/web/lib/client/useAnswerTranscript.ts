"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSpeechRecognitionConstructor,
  isSpeechRecognitionSupported,
  type BrowserSpeechRecognition,
} from "./speechRecognition";

export type TranscriptStatus = "idle" | "listening" | "stopping" | "unsupported";

interface UseAnswerTranscriptResult {
  status: TranscriptStatus;
  /** 확정된 인식 결과(누적). 정지 후 이 값이 답변 텍스트가 된다. */
  transcript: string;
  /** 아직 확정되지 않은 인식 중 텍스트 — 실시간 자막 표시용. */
  interimTranscript: string;
  /** 권한 거부/마이크 없음/네트워크 등 사용자에게 보여줄 안내 메시지. */
  errorMessage: string | null;
  start: () => void;
  stop: () => void;
  /** 문항 전환 시 호출 — 진행 중인 인식을 버리고 결과를 비운다. */
  reset: () => void;
}

/** stop() 후 브라우저가 onend를 안 주는 경우를 대비한 최대 대기 시간. */
const STOP_TIMEOUT_MS = 2500;

function joinText(...parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * 문항 하나에 대한 답변을 브라우저 음성 인식(Web Speech API)으로 받아쓰는 훅.
 *
 * - useAnswerRecorder(재생용 MediaRecorder)와 별개로 동작한다. SpeechRecognition은
 *   getUserMedia 스트림을 쓰지 않고 브라우저가 마이크를 따로 잡는다.
 * - Chrome은 continuous여도 침묵이 길거나 일정 시간이 지나면 인식 세션을 스스로 끝낸다.
 *   사용자가 정지하기 전이면 onend에서 새 세션을 이어 붙여 transcript를 계속 누적한다.
 * - 시도마다 번호(attemptRef)를 매겨, reset/언마운트 뒤 늦게 도착한 결과가 다음 문항에
 *   섞이지 않게 한다.
 */
export function useAnswerTranscript(): UseAnswerTranscriptResult {
  const [status, setStatus] = useState<TranscriptStatus>(
    isSpeechRecognitionSupported() ? "idle" : "unsupported",
  );
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const attemptRef = useRef(0);
  /** 사용자가 정지하기 전까지 true — 브라우저가 세션을 끊으면 이어서 재시작한다. */
  const wantListeningRef = useRef(false);
  const finalRef = useRef("");
  const interimRef = useRef("");
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStopTimeout = useCallback(() => {
    if (stopTimeoutRef.current !== null) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
  }, []);

  /** 인식기를 핸들러 없이 끊는다 — 이후 이벤트는 전부 무시된다. */
  const detachRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.abort();
    } catch {
      // 이미 끝난 인식기 — 무시.
    }
  }, []);

  /** 인식을 끝내고, 확정되지 못한 interim 텍스트도 최종 결과에 포함시킨다. */
  const finish = useCallback(() => {
    clearStopTimeout();
    wantListeningRef.current = false;
    finalRef.current = joinText(finalRef.current, interimRef.current);
    interimRef.current = "";
    setTranscript(finalRef.current);
    setInterimTranscript("");
    setStatus("idle");
  }, [clearStopTimeout]);

  const listen = useCallback(
    (attempt: number) => {
      const Recognition = getSpeechRecognitionConstructor();
      if (!Recognition) {
        setStatus("unsupported");
        return;
      }

      const recognition = new Recognition();
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      // 세션이 재시작되면 event.results가 비워지므로, 이전 세션까지의 확정분을 기준으로 이어 붙인다.
      const baseText = finalRef.current;

      recognition.onresult = (event) => {
        if (attempt !== attemptRef.current) return;
        let sessionFinal = "";
        let interim = "";
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i]!;
          const text = result[0]?.transcript ?? "";
          if (result.isFinal) sessionFinal = joinText(sessionFinal, text);
          else interim = joinText(interim, text);
        }
        finalRef.current = joinText(baseText, sessionFinal);
        interimRef.current = interim;
        setTranscript(finalRef.current);
        setInterimTranscript(interim);
      };

      recognition.onerror = (event) => {
        if (attempt !== attemptRef.current) return;
        switch (event.error) {
          case "no-speech":
          case "aborted":
            // 침묵/정지에 따른 정상 종료 — onend에서 재시작 여부를 판단한다.
            return;
          case "not-allowed":
          case "service-not-allowed":
            setErrorMessage("음성 인식 권한이 거부됐어요. 마이크 권한을 허용하거나, 결과 화면에서 답변을 직접 입력하세요.");
            break;
          case "audio-capture":
            setErrorMessage("음성 인식이 마이크를 사용할 수 없어요. 녹음은 계속되니, 결과 화면에서 답변을 직접 입력하세요.");
            break;
          case "network":
            setErrorMessage("음성 인식 서버에 연결하지 못했어요. 네트워크를 확인하거나, 결과 화면에서 답변을 직접 입력하세요.");
            break;
          default:
            setErrorMessage("음성 인식 중 오류가 발생했어요. 결과 화면에서 답변을 직접 입력할 수 있어요.");
        }
        // 치명적 에러 — 재시작하지 않는다.
        wantListeningRef.current = false;
      };

      recognition.onend = () => {
        if (attempt !== attemptRef.current) return;
        if (wantListeningRef.current) {
          // 사용자가 아직 녹음 중 — 브라우저가 끊은 세션을 이어서 재시작한다.
          listen(attempt);
          return;
        }
        recognitionRef.current = null;
        finish();
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        recognitionRef.current = null;
        setErrorMessage("음성 인식을 시작하지 못했어요. 결과 화면에서 답변을 직접 입력할 수 있어요.");
        finish();
      }
    },
    [finish],
  );

  const start = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      setStatus("unsupported");
      return;
    }
    if (wantListeningRef.current) return; // 이미 인식 중 — 중복 start 방지.

    clearStopTimeout();
    detachRecognition();
    const attempt = ++attemptRef.current;
    finalRef.current = "";
    interimRef.current = "";
    setTranscript("");
    setInterimTranscript("");
    setErrorMessage(null);
    wantListeningRef.current = true;
    setStatus("listening");
    listen(attempt);
  }, [clearStopTimeout, detachRecognition, listen]);

  const stop = useCallback(() => {
    if (!wantListeningRef.current && !recognitionRef.current) return;
    wantListeningRef.current = false;
    const recognition = recognitionRef.current;
    if (!recognition) {
      finish();
      return;
    }
    // stop()은 남은 오디오의 최종 결과를 보낸 뒤 onend를 준다 — 그때 finish()된다.
    setStatus("stopping");
    try {
      recognition.stop();
    } catch {
      // 무시 — 아래 타임아웃이 정리한다.
    }
    const attempt = attemptRef.current;
    clearStopTimeout();
    stopTimeoutRef.current = setTimeout(() => {
      if (attempt !== attemptRef.current) return;
      detachRecognition();
      finish();
    }, STOP_TIMEOUT_MS);
  }, [clearStopTimeout, detachRecognition, finish]);

  const discard = useCallback(() => {
    attemptRef.current += 1;
    wantListeningRef.current = false;
    clearStopTimeout();
    detachRecognition();
    finalRef.current = "";
    interimRef.current = "";
  }, [clearStopTimeout, detachRecognition]);

  const reset = useCallback(() => {
    discard();
    setTranscript("");
    setInterimTranscript("");
    setErrorMessage(null);
    setStatus(isSpeechRecognitionSupported() ? "idle" : "unsupported");
  }, [discard]);

  // 언마운트 시 인식기가 마이크를 계속 잡고 있지 않도록 정리한다.
  useEffect(() => discard, [discard]);

  return { status, transcript, interimTranscript, errorMessage, start, stop, reset };
}
