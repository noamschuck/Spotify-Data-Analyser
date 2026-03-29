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
  progressPct: number;  // 0–100
  gems: GemTrack[] | null;
  error: string | null;
  minStreams: number;
  maxStreams: number | null;   // null = no limit
  minPlaylists: number;
  maxPlaylists: number | null; // null = no limit
  setMinStreams: (n: number) => void;
  setMaxStreams: (n: number | null) => void;
  setMinPlaylists: (n: number) => void;
  setMaxPlaylists: (n: number | null) => void;
  startFind: () => void;
  reset: () => void;
}

const ForgottenGemsContext = createContext<ForgottenGemsContextType | null>(null);

export function ForgottenGemsProvider({ children }: { children: ReactNode }) {
  const { stats } = useHistory();
  const [status, setStatus] = useState<GemStatus>('idle');
  const [progress, setProgress] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [gems, setGems] = useState<GemTrack[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minStreams, setMinStreams] = useState(10);
  const [maxStreams, setMaxStreams] = useState<number | null>(null);
  const [minPlaylists, setMinPlaylists] = useState(0);
  const [maxPlaylists, setMaxPlaylists] = useState<number | null>(1);

  async function startFind() {
    if (!stats) return;
    const capturedMinStreams = minStreams;
    const capturedMaxStreams = maxStreams;
    const capturedMinPlaylists = minPlaylists;
    const capturedMaxPlaylists = maxPlaylists;

    setStatus('loading');
    setError(null);
    setGems(null);
    setProgressPct(0);

    try {
      // Pre-filter by stream count to build a candidate set — avoids tracking irrelevant tracks
      const candidates = stats.topTracks.filter(
        (t) =>
          t.streams >= capturedMinStreams &&
          (capturedMaxStreams === null || t.streams <= capturedMaxStreams)
      );
      const candidateIds = new Set(candidates.map((t) => t.trackId));

      if (candidateIds.size === 0) {
        setGems([]);
        setStatus('done');
        setProgress('');
        setProgressPct(100);
        return;
      }

      setProgress(`Fetching playlists for ${candidateIds.size} candidate tracks...`);
      setProgressPct(5);
      const playlists = await getPlaylists();
      const playlistCount = new Map<string, number>();
      const BATCH = 15;

      for (let i = 0; i < playlists.length; i += BATCH) {
        const batch = playlists.slice(i, i + BATCH);
        const scanned = Math.min(i + BATCH, playlists.length);
        setProgress(`Scanning playlist ${i + 1}–${scanned} of ${playlists.length}...`);
        setProgressPct(5 + Math.round((scanned / playlists.length) * 90));
        await Promise.all(
          batch.map(async (pl) => {
            const ids = await getPlaylistTrackIds(pl.id);
            for (const id of ids) {
              // Only track IDs that are candidates
              if (candidateIds.has(id)) {
                playlistCount.set(id, (playlistCount.get(id) ?? 0) + 1);
              }
            }
          })
        );
      }

      setProgress('Matching results...');
      setProgressPct(98);
      const result: GemTrack[] = candidates
        .filter((t) => {
          const pc = playlistCount.get(t.trackId) ?? 0;
          return pc >= capturedMinPlaylists && (capturedMaxPlaylists === null || pc <= capturedMaxPlaylists);
        })
        .map((t) => ({ ...t, playlistCount: playlistCount.get(t.trackId) ?? 0 }))
        .sort((a, b) => b.streams - a.streams);

      setGems(result);
      setStatus('done');
      setProgress('');
      setProgressPct(100);
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
    setProgressPct(0);
  }

  return (
    <ForgottenGemsContext.Provider
      value={{
        status, progress, progressPct, gems, error,
        minStreams, maxStreams, minPlaylists, maxPlaylists,
        setMinStreams, setMaxStreams, setMinPlaylists, setMaxPlaylists,
        startFind, reset,
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
