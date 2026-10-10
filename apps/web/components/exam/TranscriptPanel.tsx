import type { TranscriptStatus } from "@/lib/client/useAnswerTranscript";

interface TranscriptPanelProps {
  status: TranscriptStatus;
  /** 확정된 인식 결과 (정지 후엔 이 문항에 저장된 transcript). */
  transcript: string;
  /** 아직 확정되지 않은 인식 중 텍스트. */
  interimTranscript: string;
  errorMessage: string | null;
  /** 이 문항의 녹음이 완료됐는지 — "인식된 말이 없어요" 안내 표시 여부에 쓴다. */
  hasRecording: boolean;
}

/**
 * 녹음 중 실시간 받아쓰기(자막) 표시. 여기서는 읽기 전용이고, 인식 오류 수정은
 * 결과 화면(/result)의 답변 입력란에서 한 뒤 피드백을 받는다.
 */
export function TranscriptPanel({
  status,
  transcript,
  interimTranscript,
  errorMessage,
  hasRecording,
}: TranscriptPanelProps) {
  if (status === "unsupported") {
    return (
      <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
        이 브라우저는 음성 인식을 지원하지 않아요. Chrome을 사용하거나 결과 화면에서 답변을 직접 입력하세요.
      </div>
    );
  }

  const isActive = status === "listening" || status === "stopping";
  const hasText = transcript.trim().length > 0 || interimTranscript.trim().length > 0;
  if (!isActive && !hasText && !errorMessage && !hasRecording) return null;

  return (
    <div className="mt-4 rounded-2xl border-2 border-slate-100 bg-white p-5">
      <p className="text-xs font-bold text-slate-400">
        {status === "listening" ? "실시간 받아쓰기" : status === "stopping" ? "받아쓰기 마무리 중..." : "받아쓴 답변"}
      </p>

      {hasText ? (
        <p className="mt-2 text-sm leading-relaxed text-slate-800">
          {transcript}
          {interimTranscript && <span className="text-slate-400"> {interimTranscript}</span>}
        </p>
      ) : isActive ? (
        <p className="mt-2 text-sm text-slate-400">영어로 말하면 여기에 텍스트가 나타나요...</p>
      ) : (
        hasRecording && (
          <p className="mt-2 text-sm text-slate-400">
            인식된 말이 없어요. 다시 녹음하거나 결과 화면에서 답변을 직접 입력하세요.
          </p>
        )
      )}

      {errorMessage && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{errorMessage}</p>
      )}

      {!isActive && hasText && (
        <p className="mt-3 text-xs text-slate-400">인식이 틀린 부분은 결과 화면에서 고친 뒤 피드백을 받을 수 있어요.</p>
      )}
    </div>
  );
}
