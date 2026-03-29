import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTimeRange } from '../context/TimeRangeContext';
import { getTopTracks, getTracksById, type SpotifyTrack } from '../spotify/api';
import { TimeRangePicker } from '../components/TimeRangePicker';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { HistoryModeBar, presetToDates, type Preset } from '../components/HistoryModeBar';
import { useHistory } from '../context/HistoryContext';
import { formatMs, streamsInRange } from '../spotify/history';

interface AlbumStat {
  albumId: string;
  albumName: string;
  artistName: string;
  streams: number;
  msPlayed: number;
  trackCount: number;
  imageUrl?: string;
}

export function TopAlbums() {
  const { timeRange } = useTimeRange();
  const { stats: historyData } = useHistory();

  const [sortByStreams, setSortByStreams] = useState(false);
  const [limit, setLimit] = useState(50);
  const [limitRaw, setLimitRaw] = useState('50');
  const [preset, setPreset] = useState<Preset>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const defaultedRef = useRef(false);

  // Spotify track metadata map (fetched once per historyData)
  const [spotifyTrackMap, setSpotifyTrackMap] = useState<Map<string, SpotifyTrack>>(new Map());
  const [metadataLoading, setMetadataLoading] = useState(false);

  // Spotify fallback (no history)
  const [spotifyTracks, setSpotifyTracks] = useState<SpotifyTrack[]>([]);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (historyData && !defaultedRef.current) {
      defaultedRef.current = true;
      setSortByStreams(true);
    }
  }, [historyData]);

  // Fetch Spotify metadata for history tracks once
  useEffect(() => {
    if (!historyData || historyData.topTracks.length === 0) return;
    setMetadataLoading(true);
    const ids = historyData.topTracks.slice(0, 500).map((t) => t.trackId).filter(Boolean);
    getTracksById(ids)
      .then((data) => setSpotifyTrackMap(new Map(data.map((t) => [t.id, t]))))
      .catch(() => {})
      .finally(() => setMetadataLoading(false));
  }, [historyData]);

  // Spotify fallback
  useEffect(() => {
    if (historyData) return;
    setSpotifyLoading(true);
    setError(null);
    getTopTracks(timeRange)
      .then(setSpotifyTracks)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setSpotifyLoading(false));
  }, [historyData, timeRange]);

  const useHistoryMode = sortByStreams && !!historyData;

  // History mode: re-aggregate albums using range-specific stream counts
  const historyAlbums = useMemo<AlbumStat[]>(() => {
    if (!historyData || spotifyTrackMap.size === 0) return [];
    const hasMonthly = !!historyData.topTracks[0]?.monthlyStreams;
    let sourceTracks = historyData.topTracks.slice(0, 500);
    if (!hasMonthly) {
      if (startDate) {
        const start = new Date(startDate).getTime();
        sourceTracks = sourceTracks.filter((t) => new Date(t.lastPlayed).getTime() >= start);
      }
      if (endDate) {
        const end = new Date(endDate).getTime() + 86400000;
        sourceTracks = sourceTracks.filter((t) => new Date(t.firstPlayed).getTime() <= end);
      }
    }
    const albumMap = new Map<string, AlbumStat>();
    for (const histTrack of sourceTracks) {
      const rangeStreams = hasMonthly ? streamsInRange(histTrack, startDate, endDate) : histTrack.streams;
      if (rangeStreams === 0) continue;
      const sp = spotifyTrackMap.get(histTrack.trackId);
      const albumId = sp?.album.id ?? `_unknown_${histTrack.albumName}`;
      const albumName = sp?.album.name ?? histTrack.albumName;
      const artistName = sp?.artists[0]?.name ?? histTrack.artistName;
      const imageUrl = sp?.album.images?.[0]?.url;
      const existing = albumMap.get(albumId);
      if (existing) {
        existing.streams += rangeStreams;
        existing.msPlayed += histTrack.msPlayed;
        existing.trackCount += 1;
        if (!existing.imageUrl && imageUrl) existing.imageUrl = imageUrl;
      } else {
        albumMap.set(albumId, {
          albumId, albumName, artistName,
          streams: rangeStreams, msPlayed: histTrack.msPlayed,
          trackCount: 1, imageUrl,
        });
      }
    }
    return [...albumMap.values()]
      .sort((a, b) => b.streams - a.streams)
      .slice(0, limit);
  }, [historyData, spotifyTrackMap, startDate, endDate, limit]);

  // Spotify fallback: derive albums from top tracks
  const spotifyAlbums = useMemo<AlbumStat[]>(() => {
    const albumMap = new Map<string, AlbumStat>();
    for (const track of spotifyTracks) {
      const key = track.album.id;
      if (!albumMap.has(key)) {
        albumMap.set(key, {
          albumId: track.album.id,
          albumName: track.album.name,
          artistName: track.artists[0]?.name ?? '',
          streams: 0, msPlayed: 0, trackCount: 1,
          imageUrl: track.album.images?.[0]?.url,
        });
      } else {
        albumMap.get(key)!.trackCount += 1;
      }
    }
    return [...albumMap.values()].sort((a, b) => b.trackCount - a.trackCount);
  }, [spotifyTracks]);

  const displayedAlbums = useHistoryMode ? historyAlbums : spotifyAlbums;
  const loading = metadataLoading || spotifyLoading;

  function handleLimitInput(val: string) {
    setLimitRaw(val);
    const n = parseInt(val, 10);
    if (!isNaN(n) && n > 0) setLimit(n);
  }

  function handlePreset(p: Preset, start: string, end: string) {
    setPreset(p);
    setStartDate(start);
    setEndDate(end);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-3 gap-4">
        <h1 className="text-2xl font-bold text-violet-200">Top Albums</h1>
      </div>

      <HistoryModeBar
        hasHistory={!!historyData}
        mode={useHistoryMode ? 'history' : 'api'}
        onModeChange={(m) => setSortByStreams(m === 'history')}
        limitRaw={limitRaw}
        onLimitChange={handleLimitInput}
        preset={preset}
        onPresetChange={handlePreset}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={(v) => { setStartDate(v); setPreset('custom'); }}
        onEndDateChange={(v) => { setEndDate(v); setPreset('custom'); }}
        timeRangePicker={<TimeRangePicker />}
      />

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <p className="text-xs text-[#6b6590]">
          {useHistoryMode
            ? 'Albums ranked by streams from your listening history (top 500 tracks).'
            : 'Albums derived from your Spotify top tracks — import your history for full data.'}
        </p>
        {useHistoryMode && preset === 'custom' && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-[#6b6590]">From</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPreset('custom'); }}
              className="bg-[#262340] text-violet-200 text-xs rounded-lg px-2 py-1 border border-[#3e3b5e] focus:outline-none focus:border-violet-500"
            />
            <span className="text-xs text-[#6b6590]">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPreset('custom'); }}
              className="bg-[#262340] text-violet-200 text-xs rounded-lg px-2 py-1 border border-[#3e3b5e] focus:outline-none focus:border-violet-500"
            />
          </div>
        )}
      </div>

      {loading && <LoadingSpinner message={metadataLoading ? 'Loading album data…' : 'Fetching top albums…'} />}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && !error && displayedAlbums.length > 0 && (
        <div className="bg-[#18162a] rounded-2xl shadow-sm shadow-black border border-[#2e2b46] divide-y divide-[#2e2b46]">
          {displayedAlbums.map((album, i) => (
            <div key={album.albumId} className="flex items-center gap-3 p-3">
              <span className="text-sm font-bold text-violet-300 w-6 text-right shrink-0">{i + 1}</span>
              {album.imageUrl ? (
                <img src={album.imageUrl} alt={album.albumName} className="w-12 h-12 rounded-lg object-cover shrink-0 shadow-sm" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-[#262340] flex items-center justify-center shrink-0">
                  <span className="text-xl">💿</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                {album.albumId.startsWith('_unknown_') ? (
                  <p className="font-medium text-sm text-[#ede9f9] truncate">{album.albumName}</p>
                ) : (
                  <Link to={`/search?type=album&id=${album.albumId}`} className="font-medium text-sm text-[#ede9f9] hover:text-violet-300 truncate block">
                    {album.albumName}
                  </Link>
                )}
                <p className="text-xs text-[#6b6590] truncate">{album.artistName}</p>
                {useHistoryMode ? (
                  <p className="text-xs text-violet-400 font-semibold mt-0.5">
                    {album.streams.toLocaleString()} streams · {album.trackCount} track{album.trackCount !== 1 ? 's' : ''}
                  </p>
                ) : (
                  <p className="text-xs text-[#6b6590] mt-0.5">
                    {album.trackCount} track{album.trackCount !== 1 ? 's' : ''} in your top
                  </p>
                )}
              </div>
              {useHistoryMode && (
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-violet-400">{album.streams.toLocaleString()}×</p>
                  <p className="text-xs text-[#6b6590]">{formatMs(album.msPlayed)}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && !error && displayedAlbums.length === 0 && (
        <p className="text-sm text-[#6b6590]">No albums found.</p>
      )}
    </div>
  );
}
