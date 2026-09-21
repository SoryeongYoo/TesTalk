const MAX_PLAYS = 2;

interface SpeakerControlsProps {
  playCount: number;
  isSpeaking: boolean;
  /** 이 브라우저가 SpeechSynthesis를 아예 지원하지 않는 경우. */
  unsupported: boolean;
  onReplay: () => void;
  /** true면 재생 횟수가 남아있어도 "다시 듣기"를 막는다 (예: 녹음 중, 5초 유예 시간 초과). */
  replayLocked?: boolean;
  /** 설정되면 재생 횟수 문구 대신 이 문구를 보여준다 (예: 잠금 사유, 남은 유예 시간 카운트다운). */
  hintText?: string;
}

/**
 * 문항 오디오 재생 상태 + "다시 듣기" 버튼. 실제 오픽처럼 한 문항당 재생은 최대
 * 2회(입장 시 자동 재생 1회 + 다시 듣기 1회)까지만 제공한다.
 */
export function SpeakerControls({
  playCount,
  isSpeaking,
  unsupported,
  onReplay,
  replayLocked,
  hintText,
}: SpeakerControlsProps) {
  if (unsupported) {
    return (
      <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
        이 브라우저는 음성 재생을 지원하지 않아요. Chrome 등 다른 브라우저로 시도해보세요.
      </p>
    );
  }

  const canReplay = !isSpeaking && playCount < MAX_PLAYS && !replayLocked;

  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
          isSpeaking ? "bg-emerald-500" : "bg-emerald-100"
        }`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" fill="none" className={`h-6 w-6 ${isSpeaking ? "text-white" : "text-emerald-600"}`}>
          <path
            d="M4 9v6h4l5 5V4L8 9H4z"
            fill="currentColor"
          />
          {isSpeaking && (
            <path
              d="M16.5 8.5a5 5 0 0 1 0 7"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          )}
        </svg>
      </span>
      <div>
        <button
          type="button"
          onClick={onReplay}
          disabled={!canReplay}
          className="rounded-full border-2 border-emerald-500 px-4 py-2 text-sm font-bold text-emerald-600 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
        >
          {isSpeaking ? "재생 중..." : "다시 듣기"}
        </button>
        <p className="mt-1 text-xs font-medium text-slate-400">
          {hintText ?? `재생 ${playCount} / ${MAX_PLAYS}회`}
        </p>
      </div>
    </div>
  );
}
