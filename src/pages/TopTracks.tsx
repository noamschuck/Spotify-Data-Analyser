import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTimeRange } from '../context/TimeRangeContext';
import { getTopTracks, type SpotifyTrack } from '../spotify/api';
import { TimeRangePicker } from '../components/TimeRangePicker';
import { TrackCard } from '../components/TrackCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SavePlaylistButton } from '../components/SavePlaylistButton';
import { HistoryModeBar, type Preset } from '../components/HistoryModeBar';
import { useHistory } from '../context/HistoryContext';
import { formatMs, streamsInRange } from '../spotify/history';

export function TopTracks() {
  const { timeRange } = useTimeRange();
  const { stats: historyData } = useHistory();
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortByStreams, setSortByStreams] = useState(false);
  const [trackLimit, setTrackLimit] = useState(50);
  const [limitRaw, setLimitRaw] = useState('50');
  const [preset, setPreset] = useState<Preset>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const defaultedRef = useRef(false);

  useEffect(() => {
    if (historyData && !defaultedRef.current) {
      defaultedRef.current = true;
      setSortByStreams(true);
    }
  }, [historyData]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getTopTracks(timeRange)
      .then(setTracks)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [timeRange]);

  const historyStreamMap = new Map(
    (historyData?.topTracks ?? []).map((t) => [t.trackId, t.streams])
  );

  const useHistoryMode = sortByStreams && !!historyData;

  // Full Data: compute range-specific streams, filter, re-sort, slice to limit
  const historyTracks = useMemo(() => {
    if (!historyData) return [];
    const hasMonthly = !!historyData.topTracks[0]?.monthlyStreams;
    if (hasMonthly) {
      return historyData.topTracks
        .map((t) => ({ ...t, streams: streamsInRange(t, startDate, endDate) }))
        .filter((t) => t.streams > 0)
        .sort((a, b) => b.streams - a.streams)
        .slice(0, trackLimit);
    }
    // Old import — fall back to firstPlayed/lastPlayed filtering
    let filtered = historyData.topTracks;
    if (startDate) {
      const start = new Date(startDate).getTime();
      filtered = filtered.filter((t) => new Date(t.lastPlayed).getTime() >= start);
    }
    if (endDate) {
      const end = new Date(endDate).getTime() + 86400000;
      filtered = filtered.filter((t) => new Date(t.firstPlayed).getTime() <= end);
    }
    return filtered.slice(0, trackLimit);
  }, [historyData, startDate, endDate, trackLimit]);

  // Limited API mode: re-sort Spotify's tracks by history streams
  const spotifyDisplayed = historyData && sortByStreams
    ? [...tracks].sort((a, b) => (historyStreamMap.get(b.id) ?? -1) - (historyStreamMap.get(a.id) ?? -1))
    : tracks;

  const saveTrackIds = useHistoryMode
    ? historyTracks.map((t) => t.trackId)
    : spotifyDisplayed.map((t) => t.id);

  function handleLimitInput(val: string) {
    setLimitRaw(val);
    const n = parseInt(val, 10);
    if (!isNaN(n) && n > 0) setTrackLimit(n);
  }

  function handlePreset(p: Preset, start: string, end: string) {
    setPreset(p);
    setStartDate(start);
    setEndDate(end);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Row 1: Title + Save button */}
      <div className="flex items-center justify-between mb-3 gap-4">
        <h1 className="text-2xl font-bold text-violet-200">Top Tracks</h1>
        <SavePlaylistButton
          trackIds={saveTrackIds}
          playlistName={`My Top Tracks — ${timeRange === 'short_term' ? 'Last 4 Weeks' : timeRange === 'medium_term' ? 'Last 6 Months' : 'All Time'}`}
        />
      </div>

      {/* Row 2: Controls bar */}
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
        timeRangePicker={<TimeRangePicker />}
      />

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <p className="text-xs text-[#6b6590] leading-relaxed">
          {useHistoryMode
            ? `Showing ${historyTracks.length.toLocaleString()} tracks sorted by your actual stream count.`
            : "Spotify's ranking weighs recent listening heavily — a song played last week ranks higher than one you played 200 times a year ago."}
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

      {loading && <LoadingSpinner message="Fetching your top tracks..." />}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && !error && (
        <div className="bg-[#18162a] rounded-2xl shadow-sm shadow-black border border-[#2e2b46] divide-y divide-[#2e2b46]">
          {useHistoryMode ? (
            historyTracks.length === 0 ? (
              <p className="text-center text-[#6b6590] py-12 text-sm">
                {startDate || endDate ? 'No tracks found for this date range.' : 'No history data yet.'}
              </p>
            ) : (
              historyTracks.map((t, i) => (
                <Link
                  key={t.trackId}
                  to={`/search?type=track&id=${t.trackId}`}
                  className="flex items-center gap-3 p-3 hover:bg-[#1f1d33] transition-colors group"
                >
                  <span className="text-sm font-bold text-violet-300 w-6 text-right shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-[#ede9f9] truncate group-hover:text-violet-300">{t.trackName}</p>
                    <p className="text-xs text-[#6b6590] truncate">{t.artistName}</p>
                    <p className="text-xs text-[#6b6590] truncate">{t.albumName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-violet-400">{t.streams}×</p>
                    <p className="text-xs text-[#6b6590]">{formatMs(t.msPlayed)}</p>
                  </div>
                </Link>
              ))
            )
          ) : (
            spotifyDisplayed.length === 0 ? (
              <p className="text-center text-[#6b6590] py-12 text-sm">
                No data for this time range yet.
              </p>
            ) : (
              spotifyDisplayed.map((track, i) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  rank={i + 1}
                  streams={historyStreamMap.get(track.id)}
                />
              ))
            )
          )}
        </div>
      )}
    </div>
  );
}
