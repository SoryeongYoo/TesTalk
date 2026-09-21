interface AnswerTimerProps {
  /** 지금 실제로 카운트가 올라가고 있는지 (TTS 재생 중엔 false로 정지 표시). */
  active: boolean;
  elapsedSeconds: number;
  recommendedSeconds: number;
}

function formatTime(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * 문항별 권장 답변 시간 대비 경과 시간을 보여준다. 강제 종료는 하지 않는 "권장" 표시라
 * 시간이 지나도 카운트는 계속 올라가고, 초과 시엔 부드러운 안내 문구만 덧붙인다.
 */
export function AnswerTimer({ active, elapsedSeconds, recommendedSeconds }: AnswerTimerProps) {
  const isOver = elapsedSeconds > recommendedSeconds;
  const ratio = recommendedSeconds > 0 ? Math.min(elapsedSeconds / recommendedSeconds, 1) : 0;

  return (
    <div className="mt-4 rounded-2xl border-2 border-slate-100 bg-white p-4">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
        <span>답변 시간</span>
        <span>권장 {formatTime(recommendedSeconds)}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-2xl font-bold tabular-nums ${isOver ? "text-amber-500" : "text-slate-800"}`}>
          {formatTime(elapsedSeconds)}
        </span>
        {!active && <span className="text-xs font-medium text-slate-300">일시정지</span>}
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${isOver ? "bg-amber-400" : "bg-emerald-400"}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      {isOver && (
        <p className="mt-2 text-xs font-medium text-amber-600">
          권장 시간을 넘었어요. 편하게 이어서 답변해도 괜찮아요.
        </p>
      )}
    </div>
  );
}
