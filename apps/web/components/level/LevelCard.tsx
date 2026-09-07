interface LevelCardProps {
  level: number;
  description: string;
  /** false면 blueprint가 아직 이 난이도를 지원하지 않는다 — 클릭해도 선택되지 않는다. */
  supported: boolean;
  selected: boolean;
  onClick: () => void;
}

/** 난이도(Self-Assessment) 선택 카드. OptionCard와 같은 톤이되, 단계 배지 + 설명이 들어간다. */
export function LevelCard({ level, description, supported, selected, onClick }: LevelCardProps) {
  const disabled = !supported;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-disabled={disabled}
      className={`relative flex items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left transition-colors ${
        selected
          ? "border-emerald-500 bg-emerald-50"
          : disabled
            ? "cursor-not-allowed border-slate-100 bg-slate-50"
            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold ${
          selected
            ? "bg-emerald-500 text-white"
            : disabled
              ? "bg-slate-200 text-slate-400"
              : "bg-slate-100 text-slate-600"
        }`}
      >
        {level}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-bold ${
            selected ? "text-emerald-800" : disabled ? "text-slate-400" : "text-slate-800"
          }`}
        >
          {level}단계
        </p>
        <p className={`mt-0.5 text-sm ${disabled ? "text-slate-400" : "text-slate-500"}`}>
          {description}
        </p>
      </div>
      {disabled && (
        <span className="shrink-0 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-500">
          준비 중
        </span>
      )}
    </button>
  );
}
