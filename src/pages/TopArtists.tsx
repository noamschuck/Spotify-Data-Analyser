import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTimeRange } from '../context/TimeRangeContext';
import { getTopArtists, type SpotifyArtist } from '../spotify/api';
import { TimeRangePicker } from '../components/TimeRangePicker';
import { ArtistCard } from '../components/ArtistCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { HistoryModeBar, type Preset } from '../components/HistoryModeBar';
import { useHistory } from '../context/HistoryContext';
import { formatMs, streamsInRange } from '../spotify/history';

export function TopArtists() {
  const { timeRange } = useTimeRange();
  const { stats: historyData } = useHistory();
  const [artists, setArtists] = useState<SpotifyArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortByStreams, setSortByStreams] = useState(false);
  const [limit, setLimit] = useState(50);
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
    getTopArtists(timeRange)
      .then(setArtists)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [timeRange]);

  const useHistoryMode = sortByStreams && !!historyData;

  // Full Data: aggregate artists using range-specific stream counts
  const historyArtists = useMemo(() => {
    if (!historyData) return [];
    const hasMonthly = !!historyData.topTracks[0]?.monthlyStreams;
    let tracks = historyData.topTracks;
    // For old imports without monthly data, pre-filter by firstPlayed/lastPlayed
    if (!hasMonthly) {
      if (startDate) {
        const start = new Date(startDate).getTime();
        tracks = tracks.filter((t) => new Date(t.lastPlayed).getTime() >= start);
      }
      if (endDate) {
        const end = new Date(endDate).getTime() + 86400000;
        tracks = tracks.filter((t) => new Date(t.firstPlayed).getTime() <= end);
      }
    }
    const artistMap = new Map<string, { artistName: string; streams: number; msPlayed: number }>();
    for (const t of tracks) {
      const rangeStreams = hasMonthly ? streamsInRange(t, startDate, endDate) : t.streams;
      if (rangeStreams === 0) continue;
      const key = t.artistName.toLowerCase();
      const existing = artistMap.get(key);
      if (existing) {
        existing.streams += rangeStreams;
        existing.msPlayed += t.msPlayed;
      } else {
        artistMap.set(key, { artistName: t.artistName, streams: rangeStreams, msPlayed: t.msPlayed });
      }
    }
    return [...artistMap.values()]
      .sort((a, b) => b.streams - a.streams)
      .slice(0, limit);
  }, [historyData, startDate, endDate, limit]);

  // Limited API mode: re-sort Spotify's artists by history streams
  const historyStreamMap = new Map(
    (historyData?.topArtists ?? []).map((a) => [a.artistName.toLowerCase(), a.streams])
  );
  const spotifyDisplayed = historyData && sortByStreams
    ? [...artists].sort((a, b) => {
        const aS = historyStreamMap.get(a.name.toLowerCase()) ?? -1;
        const bS = historyStreamMap.get(b.name.toLowerCase()) ?? -1;
        return bS - aS;
      })
    : artists;

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
        <h1 className="text-2xl font-bold text-violet-200">Top Artists</h1>
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
        timeRangePicker={<TimeRangePicker />}
      />

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <p className="text-xs text-[#6b6590] leading-relaxed">
          {useHistoryMode
            ? `Showing ${historyArtists.length.toLocaleString()} artists sorted by your actual stream count.`
            : "Spotify's ranking weighs recent listening heavily."}
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

      {loading && <LoadingSpinner message="Fetching your top artists..." />}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && !error && (
        <div className="bg-[#18162a] rounded-2xl shadow-sm shadow-black border border-[#2e2b46] divide-y divide-[#2e2b46]">
          {useHistoryMode ? (
            historyArtists.length === 0 ? (
              <p className="text-center text-[#6b6590] py-12 text-sm">
                {startDate || endDate ? 'No artists found for this date range.' : 'No history data yet.'}
              </p>
            ) : (
              historyArtists.map((a, i) => (
                <Link
                  key={a.artistName}
                  to={`/search?type=artist&q=${encodeURIComponent(a.artistName)}`}
                  className="flex items-center gap-3 p-3 hover:bg-[#1f1d33] transition-colors group"
                >
                  <span className="text-sm font-bold text-violet-300 w-6 text-right shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-[#ede9f9] truncate group-hover:text-violet-300">{a.artistName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-violet-400">{a.streams.toLocaleString()}×</p>
                    <p className="text-xs text-[#6b6590]">{formatMs(a.msPlayed)}</p>
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
              spotifyDisplayed.map((artist, i) => (
                <ArtistCard
                  key={artist.id}
                  artist={artist}
                  rank={i + 1}
                  streams={historyData ? (historyStreamMap.get(artist.name.toLowerCase()) ?? undefined) : undefined}
                />
              ))
            )
          )}
        </div>
      )}
    </div>
  );
}
