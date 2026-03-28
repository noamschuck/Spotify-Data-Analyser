import { useTimeRange, TIME_RANGE_LABELS } from '../context/TimeRangeContext';
import type { TimeRange } from '../spotify/api';

const RANGES: TimeRange[] = ['short_term', 'medium_term', 'long_term'];

export function TimeRangePicker() {
  const { timeRange, setTimeRange } = useTimeRange();
  return (
    <div className="inline-flex rounded-xl bg-[#262340] p-1 gap-1">
      {RANGES.map((r) => (
        <button
          key={r}
          onClick={() => setTimeRange(r)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
            timeRange === r
              ? 'bg-[#18162a] text-violet-300 shadow-sm shadow-black'
              : 'text-violet-400 hover:text-violet-300'
          }`}
        >
          {TIME_RANGE_LABELS[r]}
        </button>
      ))}
    </div>
  );
}
