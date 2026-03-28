import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getStoredStats, type HistoryStats, type TrackStats } from '../spotify/history';

interface HistoryContextValue {
  stats: HistoryStats | null;
  loading: boolean;
  refresh: () => void;
  getTrackStats: (trackId: string) => TrackStats | null;
}

const HistoryContext = createContext<HistoryContextValue>({
  stats: null,
  loading: true,
  refresh: () => {},
  getTrackStats: () => null,
});

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    getStoredStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function getTrackStats(trackId: string): TrackStats | null {
    return stats?.topTracks.find((t) => t.trackId === trackId) ?? null;
  }

  return (
    <HistoryContext.Provider value={{ stats, loading, refresh: load, getTrackStats }}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  return useContext(HistoryContext);
}
