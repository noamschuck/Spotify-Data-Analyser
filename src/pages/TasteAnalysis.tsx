import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useTimeRange } from '../context/TimeRangeContext';
import { useHistory } from '../context/HistoryContext';
import { getTopArtists, type SpotifyArtist, type TimeRange } from '../spotify/api';
import { useArtistGenre } from '../context/ArtistGenreContext';
import { formatMs } from '../spotify/history';
import { TimeRangePicker } from '../components/TimeRangePicker';
import { LoadingSpinner } from '../components/LoadingSpinner';

interface GenreStat {
  genre: string;
  count: number;
  streams: number;
  trackCount: number;
  artists: SpotifyArtist[];
}

interface TasteProfile {
  eclecticism: number;
  focus: number;
  niche: number;
  label: string;
  description: string;
}

const ALL_PROFILES = [
  { label: 'Underground Explorer', condition: 'Eclecticism ≥ 60 and Niche ≥ 50' },
  { label: 'Eclectic Listener', condition: 'Eclecticism ≥ 60' },
  { label: 'Niche Devotee', condition: 'Focus ≥ 70 and Niche ≥ 50' },
  { label: 'Genre Purist', condition: 'Focus ≥ 70' },
  { label: 'Indie Tastemaker', condition: 'Niche ≥ 60' },
  { label: 'Balanced Explorer', condition: 'Default' },
];

const PASTEL_COLORS = [
  '#a78bfa', '#818cf8', '#60a5fa', '#93c5fd', '#c4b5fd',
  '#ddd6fe', '#bfdbfe', '#7dd3fc', '#6ee7b7', '#fcd34d',
];

const METRIC_TOOLTIPS: Record<string, string> = {
  Eclecticism:
    'How much genre overlap there is across your top artists.\n\nUnique genres ÷ total genre tags × 300, capped at 100.\n\nExample: 10 artists × 3 genres each = 30 total tags. If only 8 distinct genres exist → 8÷30×300 = 80. If all 30 are different → capped at 100.\n\nHigh score = each artist brings something new. Low score = your artists all share the same genres.',
  Focus:
    'How much of your listening is dominated by just your top 3 genres.\n\nFormula: (streams in top 3 genres ÷ total streams) × 100',
  'Niche Score':
    'How underground your taste is, based on average Spotify popularity of your top artists.\n\nFormula: 100 − average artist popularity',
};

function mergeArtists(arrays: SpotifyArtist[][]): SpotifyArtist[] {
  const seen = new Map<string, SpotifyArtist>();
  for (const arr of arrays) for (const a of arr) if (!seen.has(a.id)) seen.set(a.id, a);
  return [...seen.values()];
}

function buildGenreStats(
  artists: SpotifyArtist[],
  historyStreamsByArtist: Map<string, number>,
  historyTrackCountByArtist?: Map<string, number>,
): GenreStat[] {
  const map = new Map<string, SpotifyArtist[]>();
  for (const artist of artists) {
    for (const genre of artist.genres) {
      const list = map.get(genre) ?? [];
      list.push(artist);
      map.set(genre, list);
    }
  }
  const hasHistory = historyStreamsByArtist.size > 0;
  return [...map.entries()]
    .map(([genre, artistList]) => ({
      genre,
      count: artistList.length,
      streams: artistList.reduce((s, a) => s + (historyStreamsByArtist.get(a.name.toLowerCase()) ?? 0), 0),
      trackCount: historyTrackCountByArtist
        ? artistList.reduce((s, a) => s + (historyTrackCountByArtist.get(a.name.toLowerCase()) ?? 0), 0)
        : 0,
      artists: artistList,
    }))
    .sort((a, b) =>
      hasHistory && (a.streams > 0 || b.streams > 0) ? b.streams - a.streams : b.count - a.count
    );
}

function computeProfile(artists: SpotifyArtist[], genres: GenreStat[]): TasteProfile {
  const totalTags = genres.reduce((s, g) => s + g.count, 0);
  const eclecticism = totalTags > 0
    ? Math.min(100, Math.round((genres.length / Math.max(1, totalTags)) * 300))
    : 0;
  const top3 = genres.slice(0, 3).reduce((s, g) => s + g.count, 0);
  const focus = totalTags > 0 ? Math.round((top3 / totalTags) * 100) : 0;
  const avgPop = artists.length > 0 ? artists.reduce((s, a) => s + a.popularity, 0) / artists.length : 50;
  const niche = Math.round(100 - avgPop);

  let label: string, description: string;
  if (eclecticism >= 60 && niche >= 50) { label = 'Underground Explorer'; description = "You dig deep across many genres, favouring artists the mainstream hasn't caught up with yet."; }
  else if (eclecticism >= 60) { label = 'Eclectic Listener'; description = "Your taste spans a wide range of genres — you're hard to put in a box."; }
  else if (focus >= 70 && niche >= 50) { label = 'Niche Devotee'; description = "You go all-in on a specific corner of the music world, and it's not mainstream."; }
  else if (focus >= 70) { label = 'Genre Purist'; description = 'You know what you like and you stick with it — focused and consistent.'; }
  else if (niche >= 60) { label = 'Indie Tastemaker'; description = 'You tend to listen to artists flying under the radar before they blow up.'; }
  else { label = 'Balanced Explorer'; description = 'You mix popular picks with some genre variety — a well-rounded listener.'; }

  return { eclecticism, focus, niche, label, description };
}

export function TasteAnalysis() {
  const { timeRange } = useTimeRange();
  const { stats: historyData } = useHistory();
  const { artists, progress: genreProgress, total: genreTotal, done: genreDone, status: genreStatus } = useArtistGenre();
  const [primaryArtists, setPrimaryArtists] = useState<SpotifyArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProfileTooltip, setShowProfileTooltip] = useState(false);

  // Genre selection
  const [selectedGenre, setSelectedGenre] = useState<GenreStat | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Chart pagination
  const [chartPage, setChartPage] = useState(0);
  const PAGE_SIZE = 25;

  // Right panel view
  const [viewMode, setViewMode] = useState<'tracks' | 'artists'>('tracks');
  const [trackSort, setTrackSort] = useState<'streams' | 'name'>('streams');

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSelectedGenre(null);
    getTopArtists(timeRange)
      .then(setPrimaryArtists)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [timeRange]);

  // Reset chart page when genre data updates (artists drives genres rebuild)
  useEffect(() => { setChartPage(0); }, [artists.length]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const historyStreamsByArtist = new Map<string, number>(
    (historyData?.topArtists ?? []).map((a) => [a.artistName.toLowerCase(), a.streams])
  );
  const historyMsByArtist = new Map<string, number>(
    (historyData?.topArtists ?? []).map((a) => [a.artistName.toLowerCase(), a.msPlayed])
  );
  // Count unique tracks per artist from history
  const historyTrackCountByArtist = new Map<string, number>();
  for (const t of historyData?.topTracks ?? []) {
    const key = t.artistName.toLowerCase();
    historyTrackCountByArtist.set(key, (historyTrackCountByArtist.get(key) ?? 0) + 1);
  }
  const hasHistory = historyData !== null;

  const genres = buildGenreStats(artists, historyStreamsByArtist, historyTrackCountByArtist);
  const totalPages = Math.ceil(genres.length / PAGE_SIZE);
  const pagedGenres = genres.slice(chartPage * PAGE_SIZE, (chartPage + 1) * PAGE_SIZE);
  const profile = primaryArtists.length > 0
    ? computeProfile(primaryArtists, buildGenreStats(primaryArtists, historyStreamsByArtist))
    : null;
  const chartDataKey = hasHistory && genres.some((g) => g.streams > 0) ? 'streams' : 'count';
  const chartHeight = Math.max(200, pagedGenres.length * 28);
  const maxLabelLen = pagedGenres.reduce((m, g) => Math.max(m, g.genre.length), 0);
  const yAxisWidth = Math.min(150, Math.max(90, maxLabelLen * 6));

  function selectGenre(g: GenreStat) {
    setSelectedGenre(g);
    setDropdownOpen(false);
    setViewMode('tracks');
    setTrackSort('streams');
  }

  // Build right-panel content
  const rightContent = selectedGenre ? (() => {
    const artistNames = new Set(selectedGenre.artists.map((a) => a.name.toLowerCase()));
    const allTracks = (historyData?.topTracks ?? []).filter((t) => artistNames.has(t.artistName.toLowerCase()));
    const sortedTracks = [...allTracks].sort((a, b) =>
      trackSort === 'name' ? a.trackName.localeCompare(b.trackName) : b.streams - a.streams
    );
    const sortedArtists = [...selectedGenre.artists].sort((a, b) => {
      const aS = historyStreamsByArtist.get(a.name.toLowerCase()) ?? 0;
      const bS = historyStreamsByArtist.get(b.name.toLowerCase()) ?? 0;
      return bS !== aS ? bS - aS : b.popularity - a.popularity;
    });
    return { sortedTracks, sortedArtists };
  })() : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-violet-200">Music Taste</h1>
          <p className="text-xs text-[#6b6590] mt-0.5">
            {genreStatus === 'loading'
              ? genreTotal > 0
                ? `Loading genre data… ${genreDone}/${genreTotal} history artists (${genreProgress}%)`
                : 'Loading genre data…'
              : `Genre data from ${artists.length} artists${historyData ? ' (Spotify + streaming history)' : ''}`}
          </p>
        </div>
        <TimeRangePicker />
      </div>

      {loading && <LoadingSpinner message="Analysing your music taste..." />}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && !error && profile && (
        <div className="space-y-6">
          {/* Profile card */}
          <div
            className="bg-gradient-to-br from-[#1f1d33] to-[#1a1f33] rounded-2xl p-6 border border-[#3e3b5e] relative cursor-help"
            onMouseEnter={() => setShowProfileTooltip(true)}
            onMouseLeave={() => setShowProfileTooltip(false)}
          >
            <p className="text-xs text-violet-400 font-semibold uppercase tracking-widest mb-1">Your Taste Profile</p>
            <h2 className="text-2xl font-bold text-violet-300 mb-2">{profile.label}</h2>
            <p className="text-[#a09bc0] text-sm leading-relaxed">{profile.description}</p>
            <p className="text-xs text-[#6b6590] mt-2">Hover to see all possible profiles</p>

            {showProfileTooltip && (
              <div className="absolute left-0 top-full mt-2 w-full bg-[#1a1830] border border-[#3e3b5e] rounded-2xl p-4 shadow-xl z-20 space-y-2">
                <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-2">All Taste Profiles</p>
                {ALL_PROFILES.map((p) => (
                  <div key={p.label} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${p.label === profile.label ? 'bg-violet-900/40 border border-violet-700/40' : ''}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-semibold ${p.label === profile.label ? 'text-violet-300' : 'text-[#a09bc0]'}`}>{p.label}</p>
                        {p.label === profile.label && <span className="text-xs bg-violet-700/50 text-violet-300 px-1.5 py-0.5 rounded-full">you</span>}
                      </div>
                      <p className="text-xs text-[#6b6590]">{p.condition}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <MetricCard label="Eclecticism" value={profile.eclecticism} description="Genre variety" invert={false} />
            <MetricCard label="Focus" value={profile.focus} description="% in top 3 genres" invert />
            <MetricCard label="Niche Score" value={profile.niche} description="How underground" invert={false} />
          </div>

          {/* Separator */}
          <div className="border-t border-[#2e2b46] pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-violet-300">Genres</h2>
              {genreStatus === 'loading' && genreTotal > 0 && (
                <span className="text-xs text-violet-400">{genreDone}/{genreTotal} artists loaded</span>
              )}
            </div>
            {genreStatus === 'loading' && (
              <div className="mb-4">
                <div className="h-1 bg-[#262340] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${genreProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Two-column genre section */}
          <div className="grid grid-cols-2 gap-6 items-start">

            {/* LEFT: Genre bar chart */}
            <div className="bg-[#18162a] rounded-2xl p-5 shadow-sm shadow-black border border-[#2e2b46]">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-violet-300 text-sm">Top Genres ({genres.length})</h3>
                {hasHistory && <span className="text-xs bg-[#262340] text-violet-400 rounded-full px-2 py-0.5">by streams</span>}
              </div>
              <p className="text-xs text-[#6b6590] mb-3">Click a bar to explore that genre</p>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart
                  data={pagedGenres}
                  layout="vertical"
                  margin={{ left: 0, right: 24, top: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="genre"
                    width={yAxisWidth}
                    tick={{ fontSize: 11, fill: '#a09bc0' }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const g = payload[0].payload as GenreStat;
                      return (
                        <div className="bg-[#18162a] border border-[#3e3b5e] rounded-xl p-3 shadow-xl text-xs space-y-1">
                          <p className="font-semibold text-violet-300 capitalize mb-1.5">{g.genre}</p>
                          <p className="text-[#ede9f9]">{g.count} artist{g.count !== 1 ? 's' : ''}</p>
                          {g.trackCount > 0 && <p className="text-[#ede9f9]">{g.trackCount.toLocaleString()} song{g.trackCount !== 1 ? 's' : ''}</p>}
                          {g.streams > 0 && <p className="text-violet-400 font-semibold">{g.streams.toLocaleString()} streams</p>}
                        </div>
                      );
                    }}
                    cursor={{ fill: 'rgba(167,139,250,0.1)' }}
                  />
                  <Bar dataKey={chartDataKey} radius={[0, 5, 5, 0]} style={{ cursor: 'pointer' }} onClick={(data) => selectGenre(data as GenreStat)}>
                    {pagedGenres.map((g, i) => (
                      <Cell
                        key={g.genre}
                        fill={selectedGenre?.genre === g.genre ? '#7c3aed' : PASTEL_COLORS[(chartPage * PAGE_SIZE + i) % PASTEL_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#2e2b46]">
                  <button
                    onClick={() => setChartPage((p) => Math.max(0, p - 1))}
                    disabled={chartPage === 0}
                    className="px-3 py-1 rounded-lg text-xs font-medium bg-[#262340] text-violet-400 disabled:opacity-30 hover:bg-[#2e2b46] transition-colors cursor-pointer disabled:cursor-default"
                  >
                    ← Prev
                  </button>
                  <div className="flex items-center gap-1.5 text-xs text-[#6b6590]">
                    <span>Page</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={chartPage + 1}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (!isNaN(n) && n >= 1 && n <= totalPages) setChartPage(n - 1);
                      }}
                      className="w-10 text-center bg-[#262340] border border-[#3e3b5e] rounded-lg py-0.5 text-violet-300 focus:outline-none focus:border-violet-500"
                    />
                    <span>of {totalPages} · #{chartPage * PAGE_SIZE + 1}–{Math.min((chartPage + 1) * PAGE_SIZE, genres.length)} of {genres.length}</span>
                  </div>
                  <button
                    onClick={() => setChartPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={chartPage === totalPages - 1}
                    className="px-3 py-1 rounded-lg text-xs font-medium bg-[#262340] text-violet-400 disabled:opacity-30 hover:bg-[#2e2b46] transition-colors cursor-pointer disabled:cursor-default"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT: Genre dropdown + content */}
            <div className="space-y-3">

              {/* Dropdown */}
              <div ref={dropdownRef} className="relative">
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="w-full flex items-center justify-between bg-[#18162a] border border-[#3e3b5e] rounded-xl px-4 py-3 text-sm text-left transition-colors hover:border-violet-500/50 cursor-pointer"
                >
                  <span className={selectedGenre ? 'text-violet-200 font-medium capitalize' : 'text-[#6b6590]'}>
                    {selectedGenre ? selectedGenre.genre : 'Select a genre...'}
                  </span>
                  <span className={`text-violet-400 text-xs transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>

                {dropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-[#18162a] border border-[#3e3b5e] rounded-xl shadow-xl overflow-hidden">
                    <div className="max-h-64 overflow-y-auto divide-y divide-[#2e2b46]">
                      {genres.map((g) => (
                        <button
                          key={g.genre}
                          onClick={() => selectGenre(g)}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-[#262340] transition-colors cursor-pointer ${
                            selectedGenre?.genre === g.genre ? 'text-violet-300 bg-[#262340]' : 'text-[#ede9f9]'
                          }`}
                        >
                          <span className="capitalize truncate">{g.genre}</span>
                          <span className="text-xs text-[#6b6590] shrink-0 ml-3">
                            {g.streams > 0 ? `${g.streams.toLocaleString()}×` : `${g.count} artists`}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Genre content panel */}
              {selectedGenre && rightContent ? (
                <div className="bg-[#18162a] rounded-2xl border border-[#2e2b46] overflow-hidden">
                  {/* Genre header */}
                  <div className="px-4 pt-4 pb-3 border-b border-[#2e2b46]">
                    <h3 className="font-semibold text-violet-300 capitalize">{selectedGenre.genre}</h3>
                    <p className="text-xs text-[#6b6590] mt-0.5">
                      {selectedGenre.artists.length} artists
                      {selectedGenre.streams > 0 && ` · ${selectedGenre.streams.toLocaleString()} streams`}
                    </p>
                  </div>

                  {/* View + sort controls */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2e2b46] flex-wrap gap-2">
                    {/* View mode */}
                    <div className="inline-flex rounded-lg bg-[#262340] p-0.5 gap-0.5">
                      <button
                        onClick={() => setViewMode('tracks')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${viewMode === 'tracks' ? 'bg-[#18162a] text-violet-300 shadow-sm' : 'text-violet-400'}`}
                      >
                        Tracks
                      </button>
                      <button
                        onClick={() => setViewMode('artists')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${viewMode === 'artists' ? 'bg-[#18162a] text-violet-300 shadow-sm' : 'text-violet-400'}`}
                      >
                        Artists
                      </button>
                    </div>

                    {/* Sort (tracks only) */}
                    {viewMode === 'tracks' && rightContent.sortedTracks.length > 0 && (
                      <div className="inline-flex rounded-lg bg-[#262340] p-0.5 gap-0.5">
                        <button
                          onClick={() => setTrackSort('streams')}
                          className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${trackSort === 'streams' ? 'bg-[#18162a] text-violet-300 shadow-sm' : 'text-violet-400'}`}
                        >
                          Most Played
                        </button>
                        <button
                          onClick={() => setTrackSort('name')}
                          className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${trackSort === 'name' ? 'bg-[#18162a] text-violet-300 shadow-sm' : 'text-violet-400'}`}
                        >
                          A–Z
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="divide-y divide-[#2e2b46] overflow-y-auto" style={{ maxHeight: 420 }}>
                    {viewMode === 'tracks' ? (
                      rightContent.sortedTracks.length > 0 ? (
                        rightContent.sortedTracks.map((t, i) => (
                          <div key={t.trackId} className="flex items-center gap-3 px-4 py-2.5">
                            <span className="text-xs text-[#6b6590] w-5 text-right shrink-0">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <Link to={`/search?type=track&id=${t.trackId}`} className="text-sm font-medium text-[#ede9f9] hover:text-violet-300 truncate block">{t.trackName}</Link>
                              <Link to={`/search?q=${encodeURIComponent(t.artistName)}`} className="text-xs text-[#6b6590] hover:text-violet-400 truncate block">{t.artistName}</Link>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-semibold text-violet-400">{t.streams}×</p>
                              <p className="text-xs text-[#6b6590]">{formatMs(t.msPlayed)}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-[#6b6590] px-4 py-6 text-center">
                          {historyData ? 'No tracks from this genre in your history.' : 'Import your history to see tracks.'}
                        </p>
                      )
                    ) : (
                      rightContent.sortedArtists.map((artist) => {
                        const img = artist.images?.[0]?.url;
                        const key = artist.name.toLowerCase();
                        const streams = historyStreamsByArtist.get(key);
                        const ms = historyMsByArtist.get(key);
                        const trackCount = historyTrackCountByArtist.get(key);
                        return (
                          <Link
                            key={artist.id}
                            to={`/search?type=artist&id=${artist.id}`}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#1f1d33] transition-colors"
                          >
                            {img ? (
                              <img src={img} alt={artist.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-[#262340] shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#ede9f9] hover:text-violet-300 truncate">{artist.name}</p>
                              {streams !== undefined ? (
                                <p className="text-xs text-[#6b6590]">
                                  {trackCount !== undefined && `${trackCount} song${trackCount !== 1 ? 's' : ''} · `}{streams.toLocaleString()} streams{ms !== undefined && ` · ${formatMs(ms)}`}
                                </p>
                              ) : (
                                <p className="text-xs text-[#6b6590]">popularity {artist.popularity}</p>
                              )}
                            </div>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-[#18162a] rounded-2xl border border-[#2e2b46] border-dashed px-4 py-10 text-center">
                  <p className="text-sm text-[#6b6590]">Select a genre from the dropdown or click a bar on the left</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, description, invert }: { label: string; value: number; description: string; invert: boolean }) {
  const [showTip, setShowTip] = useState(false);
  const color = value >= 66
    ? invert ? 'text-orange-500' : 'text-violet-400'
    : value >= 33 ? 'text-blue-400'
    : invert ? 'text-green-500' : 'text-[#6b6590]';

  return (
    <div
      className="bg-[#18162a] rounded-2xl p-5 shadow-sm shadow-black border border-[#2e2b46] text-center relative cursor-help"
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <p className={`text-4xl font-bold ${color} mb-1`}>{value}</p>
      <p className="text-sm font-semibold text-violet-300">{label}</p>
      <p className="text-xs text-[#6b6590] mt-0.5">{description}</p>
      {showTip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-violet-900 text-white text-xs rounded-xl p-3 shadow-lg z-10 text-left leading-relaxed space-y-1.5">
          {METRIC_TOOLTIPS[label].split('\n\n').map((para, i) => (
            <p key={i} className={para.startsWith('Formula:') ? 'font-mono text-violet-300' : ''}>{para}</p>
          ))}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-violet-900" />
        </div>
      )}
    </div>
  );
}
