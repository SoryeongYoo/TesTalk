import type { RecordingStatus } from "@/lib/client/useAnswerRecorder";

interface RecordingControlsProps {
  /** 문제 TTS 재생이 끝나기 전에는 녹음을 시작할 수 없다. */
  enabled: boolean;
  status: RecordingStatus;
  recordingSeconds: number;
  errorMessage: string | null;
  /** 이번 문항에 보관된(또는 방금 완료된) 녹음 재생 URL. */
  audioUrl: string | null;
  onStart: () => void;
  onStop: () => void;
}

function formatTime(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * 문항별 "녹음 시작/정지" 버튼 + 녹음 중 표시(빨간 점 + 카운트업) + 방금 녹음한
 * 답변을 바로 들어볼 수 있는 플레이어.
 */
export function RecordingControls({
  enabled,
  status,
  recordingSeconds,
  errorMessage,
  audioUrl,
  onStart,
  onStop,
}: RecordingControlsProps) {
  if (status === "unsupported") {
    return (
      <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
        이 브라우저는 답변 녹음(마이크)을 지원하지 않아요. Chrome 등 다른 브라우저로 시도해보세요.
      </div>
    );
  }

  const isRecording = status === "recording";
  const isRequesting = status === "requesting";

  return (
    <div className="mt-4 rounded-2xl border-2 border-slate-100 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
              isRecording ? "bg-red-500" : "bg-slate-100"
            }`}
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" fill="none" className={`h-6 w-6 ${isRecording ? "text-white" : "text-slate-500"}`}>
              <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
              <path
                d="M5 11a7 7 0 0 0 14 0M12 18v3"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
              />
            </svg>
          </span>
          <div>
            {isRecording ? (
              <p className="flex items-center gap-2 text-sm font-bold text-red-600">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" aria-hidden="true" />
                녹음 중 {formatTime(recordingSeconds)}
              </p>
            ) : isRequesting ? (
              <p className="text-sm font-semibold text-slate-500">마이크 권한 요청 중...</p>
            ) : status === "stopped" ? (
              <p className="text-sm font-semibold text-emerald-600">녹음 완료 · {formatTime(recordingSeconds)}</p>
            ) : (
              <p className="text-sm font-semibold text-slate-500">
                {enabled ? "답변을 녹음해보세요" : "문제 재생이 끝나면 녹음할 수 있어요"}
              </p>
            )}
          </div>
        </div>

        {isRecording ? (
          <button
            type="button"
            onClick={onStop}
            className="rounded-full bg-red-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-600"
          >
            정지
          </button>
        ) : (
          <button
            type="button"
            onClick={onStart}
            disabled={!enabled || isRequesting}
            className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {status === "stopped" ? "다시 녹음" : "녹음 시작"}
          </button>
        )}
      </div>

      {errorMessage && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{errorMessage}</p>
      )}

      {audioUrl && !isRecording && (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- 사용자 본인이 방금 녹음한 음성 재생
        <audio className="mt-4 w-full" controls src={audioUrl} />
      )}
    </div>
  );
}
