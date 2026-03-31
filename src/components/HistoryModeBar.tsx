import { type ReactNode } from 'react';

export type Preset = '4W' | '6M' | '1Y' | 'All' | 'custom';

interface Props {
  hasHistory: boolean;
  mode: 'api' | 'history';
  onModeChange: (m: 'api' | 'history') => void;
  limitRaw: string;
  onLimitChange: (v: string) => void;
  preset: Preset;
  onPresetChange: (p: Preset, start: string, end: string) => void;
  startDate: string;
  endDate: string;
  timeRangePicker?: ReactNode;
}

export function presetToDates(p: Preset, currentStart = '', currentEnd = ''): { start: string; end: string } {
  if (p === 'custom') return { start: currentStart, end: currentEnd };
  if (p === 'All') return { start: '', end: '' };
  const d = new Date();
  if (p === '4W') d.setDate(d.getDate() - 28);
  if (p === '6M') d.setMonth(d.getMonth() - 6);
  if (p === '1Y') d.setFullYear(d.getFullYear() - 1);
  return { start: d.toISOString().split('T')[0], end: '' };
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: '4W', label: '4W' },
  { key: '6M', label: '6M' },
  { key: '1Y', label: '1Y' },
  { key: 'All', label: 'All' },
  { key: 'custom', label: 'Custom' },
];

export function HistoryModeBar({
  hasHistory,
  mode,
  onModeChange,
  limitRaw,
  onLimitChange,
  preset,
  onPresetChange,
  startDate,
  endDate,
  timeRangePicker,
}: Props) {
  return (
    <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
      {/* Left: mode toggle + limit */}
      <div className="flex items-center gap-3 flex-wrap">
        {hasHistory && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6b6590]">Sort by:</span>
            <div className="inline-flex rounded-xl bg-[#262340] p-1 gap-1">
              <button
                onClick={() => onModeChange('api')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  mode === 'api' ? 'bg-[#18162a] text-violet-300 shadow-sm shadow-black' : 'text-violet-400 hover:text-violet-300'
                }`}
              >
                Limited API Data
              </button>
              <button
                onClick={() => onModeChange('history')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  mode === 'history' ? 'bg-[#18162a] text-violet-300 shadow-sm shadow-black' : 'text-violet-400 hover:text-violet-300'
                }`}
              >
                Full Data
              </button>
            </div>
          </div>
        )}
        {mode === 'history' && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#6b6590]">Show top</span>
            <input
              type="text"
              inputMode="numeric"
              value={limitRaw}
              onChange={(e) => onLimitChange(e.target.value)}
              className="w-16 bg-[#262340] text-violet-200 text-xs rounded-lg px-2 py-1 border border-[#3e3b5e] focus:outline-none focus:border-violet-500 text-center"
            />
          </div>
        )}
      </div>

      {/* Right: presets (history) or time picker (api) */}
      {mode === 'history' ? (
        <div className="inline-flex rounded-xl bg-[#262340] p-1 gap-1">
          {PRESETS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                const dates = presetToDates(key, startDate, endDate);
                onPresetChange(key, dates.start, dates.end);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                preset === key ? 'bg-[#18162a] text-violet-300 shadow-sm shadow-black' : 'text-violet-400 hover:text-violet-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        timeRangePicker ?? null
      )}
    </div>
  );
}
