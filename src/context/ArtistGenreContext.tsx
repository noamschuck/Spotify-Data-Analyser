import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { openDB } from 'idb';
import { getTopArtists, searchArtistByName, type SpotifyArtist } from '../spotify/api';
import { useHistory } from './HistoryContext';

export interface ArtistGenreState {
  artists: SpotifyArtist[];
  progress: number;        // 0–100
  total: number;           // total history artists to look up
  done: number;            // how many looked up so far
  status: 'idle' | 'loading' | 'done';
}

const ArtistGenreContext = createContext<ArtistGenreState>({
  artists: [],
  progress: 0,
  total: 0,
  done: 0,
  status: 'idle',
});

const CACHE_DB = 'spotistats-genre-cache';
const CACHE_VERSION = 1;
const CACHE_STORE = 'artists';

async function getDB() {
  return openDB(CACHE_DB, CACHE_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE);
    },
  });
}

async function loadCache(importedAt: string): Promise<SpotifyArtist[] | null> {
  const db = await getDB();
  const entry = await db.get(CACHE_STORE, 'data') as { importedAt: string; artists: SpotifyArtist[] } | undefined;
  return entry?.importedAt === importedAt ? entry.artists : null;
}

async function saveCache(importedAt: string, artists: SpotifyArtist[]): Promise<void> {
  const db = await getDB();
  await db.put(CACHE_STORE, { importedAt, artists }, 'data');
}

function mergeArtists(arrays: SpotifyArtist[][]): SpotifyArtist[] {
  const seen = new Map<string, SpotifyArtist>();
  for (const arr of arrays) for (const a of arr) if (!seen.has(a.id)) seen.set(a.id, a);
  return [...seen.values()];
}

export function ArtistGenreProvider({ children }: { children: ReactNode }) {
  const { stats: historyData } = useHistory();
  const [artists, setArtists] = useState<SpotifyArtist[]>([]);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;

    async function run() {
      setStatus('loading');
      setProgress(0);
      setDone(0);
      setTotal(0);

      const importedAt = historyData?.importedAt;

      // Check cache if history is available
      if (importedAt) {
        const cached = await loadCache(importedAt);
        if (cached && !cancelRef.current) {
          setArtists(cached);
          setProgress(100);
          setStatus('done');
          return;
        }
      }

      // Phase 1: fetch Spotify top artists (all 3 ranges)
      const ranges = ['short_term', 'medium_term', 'long_term'] as const;
      const results = await Promise.all(
        ranges.map((r) => getTopArtists(r).catch(() => [] as SpotifyArtist[]))
      );
      const apiArtists = mergeArtists(results);

      if (cancelRef.current) return;
      setArtists(apiArtists);

      // If no history, we're done
      if (!historyData) {
        setProgress(100);
        setStatus('done');
        return;
      }

      // Phase 2: find history artists missing from API results and search for them
      const apiNames = new Set(apiArtists.map((a) => a.name.toLowerCase()));
      const missingNames = historyData.topArtists
        .filter((a) => !apiNames.has(a.artistName.toLowerCase()))
        .map((a) => a.artistName);

      const totalMissing = missingNames.length;
      setTotal(totalMissing);
      setProgress(15); // Phase 1 complete = 15%

      if (totalMissing === 0) {
        setProgress(100);
        setStatus('done');
        await saveCache(importedAt!, apiArtists);
        return;
      }

      const BATCH = 5;
      let completedCount = 0;
      let merged = [...apiArtists];
      let lastFlushThreshold = 0; // which 20% band we last flushed at

      for (let i = 0; i < missingNames.length; i += BATCH) {
        if (cancelRef.current) return;
        const batch = missingNames.slice(i, i + BATCH);
        const found = await Promise.all(batch.map((name) => searchArtistByName(name)));
        const valid = found.filter((a): a is SpotifyArtist => a !== null);
        merged = mergeArtists([merged, valid]);
        completedCount += batch.length;

        if (!cancelRef.current) {
          const pct = 15 + Math.round((completedCount / totalMissing) * 85);
          // Always update progress counter for the bar
          setDone(completedCount);
          setProgress(pct);

          // Only push new artists to state at each 20% boundary
          const band = Math.floor(pct / 20) * 20;
          if (band > lastFlushThreshold) {
            lastFlushThreshold = band;
            setArtists([...merged]);
          }
        }
      }

      if (!cancelRef.current) {
        setProgress(100);
        setStatus('done');
        await saveCache(importedAt!, merged);
      }
    }

    void run();
    return () => { cancelRef.current = true; };
  }, [historyData?.importedAt]); // re-run when history is imported/changed

  return (
    <ArtistGenreContext.Provider value={{ artists, progress, total, done, status }}>
      {children}
    </ArtistGenreContext.Provider>
  );
}

export function useArtistGenre() {
  return useContext(ArtistGenreContext);
}
