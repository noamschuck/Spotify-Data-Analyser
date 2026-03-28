import { createContext, useContext, useState, type ReactNode } from 'react';
import { getPlaylists, getPlaylistTrackIds } from '../spotify/api';
import { type TrackStats } from '../spotify/history';
import { useHistory } from './HistoryContext';

export interface GemTrack extends TrackStats {
  playlistCount: number;
}

type GemStatus = 'idle' | 'loading' | 'done';

interface ForgottenGemsContextType {
  status: GemStatus;
  progress: string;
  gems: GemTrack[] | null;
  error: string | null;
  minStreams: number;
  maxPlaylists: 0 | 1;
  setMinStreams: (n: number) => void;
  setMaxPlaylists: (n: 0 | 1) => void;
  startFind: () => void;
  reset: () => void;
}

const ForgottenGemsContext = createContext<ForgottenGemsContextType | null>(null);

export function ForgottenGemsProvider({ children }: { children: ReactNode }) {
  const { stats } = useHistory();
  const [status, setStatus] = useState<GemStatus>('idle');
  const [progress, setProgress] = useState('');
  const [gems, setGems] = useState<GemTrack[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minStreams, setMinStreams] = useState(10);
  const [maxPlaylists, setMaxPlaylists] = useState<0 | 1>(1);

  async function startFind() {
    if (!stats) return;
    // Capture values at invocation time
    const capturedMin = minStreams;
    const capturedMax = maxPlaylists;

    setStatus('loading');
    setError(null);
    setGems(null);

    try {
      setProgress('Fetching your playlists...');
      const playlists = await getPlaylists();
      const playlistCount = new Map<string, number>();
      const BATCH = 8;

      for (let i = 0; i < playlists.length; i += BATCH) {
        const batch = playlists.slice(i, i + BATCH);
        setProgress(
          `Scanning playlist ${i + 1}–${Math.min(i + BATCH, playlists.length)} of ${playlists.length}...`
        );
        await Promise.all(
          batch.map(async (pl) => {
            const ids = await getPlaylistTrackIds(pl.id);
            for (const id of ids) {
              playlistCount.set(id, (playlistCount.get(id) ?? 0) + 1);
            }
          })
        );
      }

      setProgress('Matching against your history...');
      const result: GemTrack[] = stats.topTracks
        .filter(
          (t) =>
            t.streams >= capturedMin &&
            (playlistCount.get(t.trackId) ?? 0) <= capturedMax
        )
        .map((t) => ({
          ...t,
          playlistCount: playlistCount.get(t.trackId) ?? 0,
        }));

      setGems(result);
      setStatus('done');
      setProgress('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('idle');
    }
  }

  function reset() {
    setGems(null);
    setStatus('idle');
    setError(null);
    setProgress('');
  }

  return (
    <ForgottenGemsContext.Provider
      value={{
        status,
        progress,
        gems,
        error,
        minStreams,
        maxPlaylists,
        setMinStreams,
        setMaxPlaylists,
        startFind,
        reset,
      }}
    >
      {children}
    </ForgottenGemsContext.Provider>
  );
}

export function useForgottenGems() {
  const ctx = useContext(ForgottenGemsContext);
  if (!ctx) throw new Error('useForgottenGems must be used within ForgottenGemsProvider');
  return ctx;
}
