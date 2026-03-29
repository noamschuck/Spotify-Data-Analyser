import { openDB, type IDBPDatabase } from 'idb';

// Shape of each entry in Spotify's Extended Streaming History JSON files
export interface RawStreamEntry {
  ts: string;
  ms_played: number;
  master_metadata_track_name: string | null;
  master_metadata_album_artist_name: string | null;
  master_metadata_album_album_name: string | null;
  spotify_track_uri: string | null;
  reason_end: string | null;
  skipped: boolean | null;
}

export interface TrackStats {
  trackId: string;        // extracted from spotify_track_uri
  trackName: string;
  artistName: string;
  albumName: string;
  streams: number;        // times played (ms_played > 30s) — all-time
  msPlayed: number;       // total ms — all-time
  firstPlayed: string;    // ISO timestamp of first stream
  lastPlayed: string;     // ISO timestamp of most recent stream
  monthlyStreams: Record<string, number>; // "YYYY-MM" → stream count
}

export interface ArtistStats {
  artistName: string;
  streams: number;
  msPlayed: number;
  firstPlayed: string;    // ISO timestamp of first stream for any of their tracks
}

export interface MonthlyStats {
  month: string;          // "2024-03"
  streams: number;
  msPlayed: number;
}

export interface HistoryStats {
  totalStreams: number;
  totalMsPlayed: number;
  uniqueTrackCount: number;
  uniqueArtistCount: number;
  topTracks: TrackStats[];
  topArtists: ArtistStats[];
  monthly: MonthlyStats[];
  importedAt: string;
  entryCount: number;
}

const DB_NAME = 'spotistats-history';
const DB_VERSION = 1;
const STATS_KEY = 'computed-stats';

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta');
      }
    },
  });
}

export async function getStoredStats(): Promise<HistoryStats | null> {
  const db = await getDB();
  return (await db.get('meta', STATS_KEY)) ?? null;
}

export async function clearHistory(): Promise<void> {
  const db = await getDB();
  await db.delete('meta', STATS_KEY);
}

export function extractTrackId(uri: string | null): string | null {
  if (!uri) return null;
  const parts = uri.split(':');
  return parts.length === 3 && parts[1] === 'track' ? parts[2] : null;
}

function formatMonth(ts: string): string {
  return ts.slice(0, 7); // "2024-03"
}

// Parse one or more Spotify streaming history JSON files and compute stats
export async function importHistoryFiles(
  files: File[],
  onProgress: (pct: number) => void
): Promise<HistoryStats> {
  const allEntries: RawStreamEntry[] = [];

  for (let i = 0; i < files.length; i++) {
    const text = await files[i].text();
    const parsed = JSON.parse(text) as RawStreamEntry[];
    allEntries.push(...parsed);
    onProgress(Math.round(((i + 1) / files.length) * 40));
  }

  // Only count streams where the user actually listened (>30s) and it's a track
  const validEntries = allEntries.filter(
    (e) =>
      e.ms_played >= 30_000 &&
      e.master_metadata_track_name &&
      e.master_metadata_album_artist_name &&
      e.spotify_track_uri
  );

  onProgress(50);

  // Aggregate by track
  const trackMap = new Map<string, TrackStats>();
  const artistMap = new Map<string, ArtistStats>();
  const monthMap = new Map<string, MonthlyStats>();

  for (const entry of validEntries) {
    const trackId = extractTrackId(entry.spotify_track_uri) ?? entry.spotify_track_uri!;
    const trackName = entry.master_metadata_track_name!;
    const artistName = entry.master_metadata_album_artist_name!;
    const albumName = entry.master_metadata_album_album_name ?? '';
    const month = formatMonth(entry.ts);

    // Track stats
    const existing = trackMap.get(trackId);
    if (existing) {
      existing.streams += 1;
      existing.msPlayed += entry.ms_played;
      if (entry.ts > existing.lastPlayed) existing.lastPlayed = entry.ts;
      if (entry.ts < existing.firstPlayed) existing.firstPlayed = entry.ts;
      existing.monthlyStreams[month] = (existing.monthlyStreams[month] ?? 0) + 1;
    } else {
      trackMap.set(trackId, {
        trackId,
        trackName,
        artistName,
        albumName,
        streams: 1,
        msPlayed: entry.ms_played,
        firstPlayed: entry.ts,
        lastPlayed: entry.ts,
        monthlyStreams: { [month]: 1 },
      });
    }

    // Artist stats
    const artist = artistMap.get(artistName);
    if (artist) {
      artist.streams += 1;
      artist.msPlayed += entry.ms_played;
      if (entry.ts < artist.firstPlayed) artist.firstPlayed = entry.ts;
    } else {
      artistMap.set(artistName, { artistName, streams: 1, msPlayed: entry.ms_played, firstPlayed: entry.ts });
    }

    // Monthly stats
    const mo = monthMap.get(month);
    if (mo) {
      mo.streams += 1;
      mo.msPlayed += entry.ms_played;
    } else {
      monthMap.set(month, { month, streams: 1, msPlayed: entry.ms_played });
    }
  }

  onProgress(80);

  const stats: HistoryStats = {
    totalStreams: validEntries.length,
    totalMsPlayed: validEntries.reduce((s, e) => s + e.ms_played, 0),
    uniqueTrackCount: trackMap.size,
    uniqueArtistCount: artistMap.size,
    topTracks: [...trackMap.values()].sort((a, b) => b.streams - a.streams),
    topArtists: [...artistMap.values()].sort((a, b) => b.streams - a.streams),
    monthly: [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month)),
    importedAt: new Date().toISOString(),
    entryCount: allEntries.length,
  };

  const db = await getDB();
  await db.put('meta', stats, STATS_KEY);

  onProgress(100);
  return stats;
}

// Returns stream count within [startDate, endDate] using monthly data.
// Pass empty strings for open bounds. Falls back to all-time streams if no monthly data.
export function streamsInRange(
  track: TrackStats,
  startDate: string,
  endDate: string,
): number {
  if (!track.monthlyStreams) return track.streams; // old import — no monthly data
  if (!startDate && !endDate) return track.streams;
  const startMonth = startDate ? startDate.slice(0, 7) : null;
  const endMonth = endDate ? endDate.slice(0, 7) : null;
  return Object.entries(track.monthlyStreams).reduce((sum, [month, count]) => {
    if (startMonth && month < startMonth) return sum;
    if (endMonth && month > endMonth) return sum;
    return sum + count;
  }, 0);
}

export function formatMs(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  }
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}
