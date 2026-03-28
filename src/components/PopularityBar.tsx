interface Props {
  value: number; // 0–100
  label?: string;
}

export function PopularityBar({ value, label }: Props) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-slate-400 w-20 shrink-0">{label}</span>}
      <div className="flex-1 h-1.5 bg-[#2e2b46] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-400 to-blue-400 rounded-full transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-slate-400 w-6 text-right shrink-0">{value}</span>
    </div>
  );
}
