interface OptionCardProps {
  label: string;
  selected: boolean;
  /** single이면 원형(라디오), multi면 사각형(체크박스) 인디케이터를 그린다. */
  shape: "single" | "multi";
  /**
   * true면 클릭해도 선택되지 않는 상태로 흐리게 표시한다(예: part4~7 합계 12개
   * 도달 후 아직 선택하지 않은 카드). 이미 선택된 카드는 해제할 수 있어야 하므로
   * 이 prop과 무관하게 항상 클릭 가능하게 렌더링한다 — 호출부가 selected일 때는
   * disabled를 넘기지 않는다.
   */
  disabled?: boolean;
  onClick: () => void;
}

/** 설문 선택지 카드. 선택 시 테두리/배경/인디케이터 색이 뚜렷하게 바뀐다. */
export function OptionCard({ label, selected, shape, disabled = false, onClick }: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-disabled={disabled}
      className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left transition-colors ${
        selected
          ? "border-emerald-500 bg-emerald-50 text-emerald-800"
          : disabled
            ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center border-2 ${
          shape === "single" ? "rounded-full" : "rounded-md"
        } ${
          selected
            ? "border-emerald-500 bg-emerald-500"
            : disabled
              ? "border-slate-200 bg-slate-100"
              : "border-slate-300 bg-white"
        }`}
      >
        {selected && (
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="h-3.5 w-3.5 text-white"
            aria-hidden="true"
          >
            <path
              d="M4 10.5L8 14.5L16 6"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className="text-sm font-semibold sm:text-base">{label}</span>
    </button>
  );
}
