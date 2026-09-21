export type ExamMode = "study" | "real";

interface ModeToggleProps {
  mode: ExamMode;
  onChange: (mode: ExamMode) => void;
}

/** 학습 모드(텍스트 보임) / 실전 모드(텍스트 숨김) 전환. 문항이 바뀌어도 선택이 유지된다. */
export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="inline-flex rounded-full border-2 border-slate-200 bg-white p-1 text-xs font-bold">
      <button
        type="button"
        onClick={() => onChange("study")}
        aria-pressed={mode === "study"}
        className={`rounded-full px-3 py-1.5 transition-colors ${
          mode === "study" ? "bg-emerald-500 text-white" : "text-slate-500 hover:text-slate-700"
        }`}
      >
        학습 모드
      </button>
      <button
        type="button"
        onClick={() => onChange("real")}
        aria-pressed={mode === "real"}
        className={`rounded-full px-3 py-1.5 transition-colors ${
          mode === "real" ? "bg-emerald-500 text-white" : "text-slate-500 hover:text-slate-700"
        }`}
      >
        실전 모드
      </button>
    </div>
  );
}
