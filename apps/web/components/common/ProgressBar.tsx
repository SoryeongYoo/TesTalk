interface ProgressBarProps {
  current: number;
  total: number;
}

/** 상단 진행바. current/total 비율만큼 채워진다. 설문(/survey)·응시(/exam) 화면이 공유한다. */
export function ProgressBar({ current, total }: ProgressBarProps) {
  const percent = Math.round((current / total) * 100);

  return (
    <div className="w-full">
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs font-medium text-slate-400">
        {current} / {total}
      </p>
    </div>
  );
}
