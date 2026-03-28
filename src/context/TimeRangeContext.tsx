import { createContext, useContext, useState, type ReactNode } from 'react';
import type { TimeRange } from '../spotify/api';

interface TimeRangeContextValue {
  timeRange: TimeRange;
  setTimeRange: (r: TimeRange) => void;
}

const TimeRangeContext = createContext<TimeRangeContextValue>({
  timeRange: 'short_term',
  setTimeRange: () => {},
});

export function TimeRangeProvider({ children }: { children: ReactNode }) {
  const [timeRange, setTimeRange] = useState<TimeRange>('short_term');
  return (
    <TimeRangeContext.Provider value={{ timeRange, setTimeRange }}>
      {children}
    </TimeRangeContext.Provider>
  );
}

export function useTimeRange() {
  return useContext(TimeRangeContext);
}

export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  short_term: '4 Weeks',
  medium_term: '6 Months',
  long_term: 'All Time',
};
