import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SavePlaylistButton } from '../components/SavePlaylistButton';
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
import { getTopArtists, type SpotifyArtist } from '../spotify/api';
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

interface ParentGenreStat {
  genre: string;   // = parent label (for chart compat)
  parent: string;
  count: number;
  streams: number;
  trackCount: number;
  subgenres: GenreStat[];
  artists: SpotifyArtist[];
}

// Ordered: first match wins. More specific families before broad catch-alls.
const GENRE_PARENTS: { parent: string; keywords: string[] }[] = [
  { parent: 'Folk',              keywords: ['folk'] },
  { parent: 'Metal',             keywords: ['metal', 'metalcore', 'grindcore', 'deathcore', 'mathcore'] },
  { parent: 'Punk',              keywords: ['punk', 'hardcore', 'emo', 'screamo'] },
  { parent: 'Hip-Hop',           keywords: ['hip hop', 'hip-hop', 'rap', 'trap', 'drill', 'grime', 'boom bap'] },
  { parent: 'Electronic',        keywords: ['electronic', 'edm', 'techno', 'house', 'trance', 'dubstep', 'drum and bass', 'ambient', 'electronica', 'idm', 'synthwave', 'vaporwave', 'chillwave', 'electro'] },
  { parent: 'Jazz',              keywords: ['jazz', 'bebop', 'swing', 'bossa nova', 'samba'] },
  { parent: 'Classical',         keywords: ['classical', 'orchestral', 'baroque', 'opera', 'symphony', 'neoclassical', 'chamber music'] },
  { parent: 'Blues',             keywords: ['blues'] },
  { parent: 'Soul / R&B',        keywords: ['r&b', 'soul', 'funk', 'motown', 'gospel', 'neo soul'] },
  { parent: 'Country',           keywords: ['country', 'americana', 'bluegrass', 'outlaw'] },
  { parent: 'Reggae',            keywords: ['reggae', 'dancehall', 'ska', 'dub'] },
  { parent: 'Latin',             keywords: ['latin', 'reggaeton', 'salsa', 'bachata', 'cumbia', 'sertanejo', 'afrobeat', 'afropop', 'mpb'] },
  { parent: 'Rock',              keywords: ['rock', 'grunge', 'shoegaze', 'britpop'] },
  { parent: 'Pop',               keywords: ['pop', 'bubblegum'] },
  { parent: 'K-Pop / J-Pop',     keywords: ['k-pop', 'j-pop', 'kpop', 'jpop', 'j-rock', 'anime'] },
  { parent: 'Singer-Songwriter', keywords: ['singer-songwriter', 'singer songwriter'] },
  { parent: 'Indie',             keywords: ['indie', 'lo-fi', 'bedroom'] },
];

function getParentGenre(genre: string): string {
  const lower = genre.toLowerCase();
  for (const { parent, keywords } of GENRE_PARENTS) {
    if (keywords.some((kw) => lower.includes(kw))) return parent;
  }
  return genre;
}

function groupByParent(
  genres: GenreStat[],
  historyStreamsByArtist: Map<string, number>,
  historyTrackCountByArtist: Map<string, number>,
): ParentGenreStat[] {
  // First pass: collect subgenres and deduplicated artist lists per parent
  const subgenreMap = new Map<string, GenreStat[]>();
  const artistMap = new Map<string, Map<string, SpotifyArtist>>(); // parent → artistId → artist

  for (const g of genres) {
    const parent = getParentGenre(g.genre);
    if (!subgenreMap.has(parent)) { subgenreMap.set(parent, []); artistMap.set(parent, new Map()); }
    subgenreMap.get(parent)!.push(g);
    const seen = artistMap.get(parent)!;
    for (const a of g.artists) if (!seen.has(a.id)) seen.set(a.id, a);
  }

  // Second pass: build ParentGenreStat with totals computed from deduped artists only
  const hasStreams = genres.some((g) => g.streams > 0);
  return [...subgenreMap.entries()]
    .map(([parent, subgenres]) => {
      const artists = [...artistMap.get(parent)!.values()];
      const streams = artists.reduce((s, a) => s + (historyStreamsByArtist.get(a.name.toLowerCase()) ?? 0), 0);
      const trackCount = artists.reduce((s, a) => s + (historyTrackCountByArtist.get(a.name.toLowerCase()) ?? 0), 0);
      return { genre: parent, parent, count: artists.length, streams, trackCount, subgenres, artists };
    })
    .sort((a, b) => hasStreams ? b.streams - a.streams : b.count - a.count);
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
    'How broadly and evenly you listen across major genre families (Rock, Folk, Hip-Hop, Electronic, Jazz, etc.).\n\nScore = Breadth × Evenness\n\nBreadth: how many distinct genre families you span (need 10+ for full credit).\nEvenness: how balanced your listening is across them — listening 90% to one genre and 10% to nine others scores low.\n\n100 requires spanning 10+ genre families with genuinely balanced listening across all of them.',
  Focus:
    'How much of your listening is dominated by just your top 3 genres.\n\nFormula: (streams in top 3 genres ÷ total streams) × 100',
  'Niche Score':
    'How underground your taste is, based on average Spotify popularity of your top artists.\n\nFormula: 100 − average artist popularity',
};

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

function computeEclecticism(parentGroups: ParentGenreStat[]): number {
  const n = parentGroups.length;
  if (n <= 1) return 0;

  const hasStreams = parentGroups.some((g) => g.streams > 0);
  const values = parentGroups.map((g) => hasStreams ? g.streams : g.count);
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;

  // Evenness: Shannon entropy normalised to 0–1
  const H = values
    .filter((v) => v > 0)
    .reduce((s, v) => s - (v / total) * Math.log2(v / total), 0);
  const evenness = H / Math.log2(n); // 1.0 = perfectly even across all groups

  // Breadth: need 10+ distinct parent genre families for full credit
  const breadth = Math.min(1, n / 10);

  return Math.min(100, Math.round(evenness * breadth * 100));
}

function computeProfile(artists: SpotifyArtist[], genres: GenreStat[], parentGroups: ParentGenreStat[]): TasteProfile {
  const eclecticism = computeEclecticism(parentGroups);

  const totalTags = genres.reduce((s, g) => s + g.count, 0);
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

export function TasteAnalysis({ embedded = false }: { embedded?: boolean }) {
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
  const [dropdownMode, setDropdownMode] = useState<'groups' | 'subgenres'>('groups');
  const [genreSearch, setGenreSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Chart drill-down
  const [expandedParent, setExpandedParent] = useState<string | null>(null);

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

  // Reset chart page when genre data or drill-down changes
  useEffect(() => { setChartPage(0); }, [artists.length]);
  useEffect(() => { setChartPage(0); }, [expandedParent]);

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
  // Count unique tracks per artist from history (≥3 streams only)
  const historyTrackCountByArtist = new Map<string, number>();
  for (const t of historyData?.topTracks ?? []) {
    if (t.streams < 3) continue;
    const key = t.artistName.toLowerCase();
    historyTrackCountByArtist.set(key, (historyTrackCountByArtist.get(key) ?? 0) + 1);
  }
  const hasHistory = historyData !== null;

  const genres = buildGenreStats(artists, historyStreamsByArtist, historyTrackCountByArtist);
  const groupedGenres = groupByParent(genres, historyStreamsByArtist, historyTrackCountByArtist);

  // Chart data: subgenres when drilled in, parent groups otherwise
  const chartData: (GenreStat | ParentGenreStat)[] = expandedParent !== null
    ? genres.filter((g) => getParentGenre(g.genre) === expandedParent)
    : groupedGenres;

  const totalPages = Math.ceil(chartData.length / PAGE_SIZE);
  const pagedData = chartData.slice(chartPage * PAGE_SIZE, (chartPage + 1) * PAGE_SIZE);
  const primaryGenres = buildGenreStats(primaryArtists, historyStreamsByArtist);
  const primaryParentGroups = groupByParent(primaryGenres, historyStreamsByArtist, historyTrackCountByArtist);
  const profile = primaryArtists.length > 0
    ? computeProfile(primaryArtists, primaryGenres, primaryParentGroups)
    : null;
  const chartDataKey = hasHistory && genres.some((g) => g.streams > 0) ? 'streams' : 'count';
  const chartHeight = Math.max(200, pagedData.length * 28);
  const maxLabelLen = pagedData.reduce((m, g) => Math.max(m, g.genre.length), 0);
  const yAxisWidth = Math.min(150, Math.max(90, maxLabelLen * 6));

  function selectGenre(g: GenreStat) {
    setSelectedGenre(g);
    setDropdownOpen(false);
    setGenreSearch('');
    setViewMode('tracks');
    setTrackSort('streams');
  }

  function handleBarClick(data: GenreStat | ParentGenreStat) {
    if (expandedParent !== null) {
      // In subgenre view — select the genre for the right panel
      selectGenre(data as GenreStat);
    } else {
      const pg = data as ParentGenreStat;
      if (pg.subgenres.length === 1) {
        // Only one subgenre — select it directly
        selectGenre(pg.subgenres[0]);
      } else {
        // Drill into subgenres
        setExpandedParent(pg.parent);
      }
    }
  }

  // Build right-panel content
  const rightContent = selectedGenre ? (() => {
    const artistNames = new Set(selectedGenre.artists.map((a) => a.name.toLowerCase()));
    const allTracks = (historyData?.topTracks ?? []).filter((t) => artistNames.has(t.artistName.toLowerCase()) && t.streams >= 3);
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

  const inner = (
    <>
      {!embedded && (
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
      )}

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
                {expandedParent !== null ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedParent(null)}
                      className="text-xs text-violet-400 hover:text-violet-300 cursor-pointer"
                    >
                      ← All
                    </button>
                    <span className="text-xs text-[#6b6590]">/</span>
                    <h3 className="font-semibold text-violet-300 text-sm">{expandedParent}</h3>
                    <span className="text-xs text-[#6b6590]">({chartData.length} subgenres)</span>
                  </div>
                ) : (
                  <h3 className="font-semibold text-violet-300 text-sm">
                    Top Genres <span className="text-[#6b6590] font-normal">({groupedGenres.length} groups · {genres.length} total)</span>
                  </h3>
                )}
                {hasHistory && <span className="text-xs bg-[#262340] text-violet-400 rounded-full px-2 py-0.5">by streams</span>}
              </div>
              <p className="text-xs text-[#6b6590] mb-3">
                {expandedParent !== null ? 'Click a bar to explore · ← All to go back' : 'Click a bar to expand subgenres'}
              </p>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart
                  data={pagedData}
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
                      const g = payload[0].payload as GenreStat | ParentGenreStat;
                      const subCount = 'subgenres' in g ? g.subgenres.length : null;
                      return (
                        <div className="bg-[#18162a] border border-[#3e3b5e] rounded-xl p-3 shadow-xl text-xs space-y-1">
                          <p className="font-semibold text-violet-300 capitalize mb-1.5">{g.genre}</p>
                          {subCount !== null && subCount > 1 && <p className="text-[#6b6590]">{subCount} subgenres · click to expand</p>}
                          <p className="text-[#ede9f9]">{g.count} artist{g.count !== 1 ? 's' : ''}</p>
                          {g.trackCount > 0 && <p className="text-[#ede9f9]">{g.trackCount.toLocaleString()} song{g.trackCount !== 1 ? 's' : ''}</p>}
                          {g.streams > 0 && <p className="text-violet-400 font-semibold">{g.streams.toLocaleString()} streams</p>}
                        </div>
                      );
                    }}
                    cursor={{ fill: 'rgba(167,139,250,0.1)' }}
                  />
                  <Bar dataKey={chartDataKey} radius={[0, 5, 5, 0]} style={{ cursor: 'pointer' }} onClick={(data) => handleBarClick(data as unknown as GenreStat | ParentGenreStat)}>
                    {pagedData.map((g, i) => (
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
                    <span>of {totalPages} · #{chartPage * PAGE_SIZE + 1}–{Math.min((chartPage + 1) * PAGE_SIZE, chartData.length)} of {chartData.length}</span>
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
                    {/* Mode toggle */}
                    <div className="flex border-b border-[#2e2b46]">
                      <button
                        onClick={() => setDropdownMode('groups')}
                        className={`flex-1 py-2 text-xs font-medium transition-colors cursor-pointer ${dropdownMode === 'groups' ? 'text-violet-300 bg-[#1f1d33]' : 'text-[#6b6590] hover:text-violet-400'}`}
                      >
                        Genres ({groupedGenres.length})
                      </button>
                      <button
                        onClick={() => setDropdownMode('subgenres')}
                        className={`flex-1 py-2 text-xs font-medium transition-colors cursor-pointer border-l border-[#2e2b46] ${dropdownMode === 'subgenres' ? 'text-violet-300 bg-[#1f1d33]' : 'text-[#6b6590] hover:text-violet-400'}`}
                      >
                        Subgenres ({genres.length})
                      </button>
                    </div>
                    {/* Search */}
                    <div className="px-3 py-2 border-b border-[#2e2b46]">
                      <input
                        type="text"
                        value={genreSearch}
                        onChange={(e) => setGenreSearch(e.target.value)}
                        placeholder="Search genres…"
                        className="w-full bg-[#262340] rounded-lg px-3 py-1.5 text-xs text-[#ede9f9] placeholder-[#6b6590] focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto divide-y divide-[#2e2b46]">
                      {dropdownMode === 'groups'
                        ? groupedGenres
                            .filter((pg) => !genreSearch || pg.genre.toLowerCase().includes(genreSearch.toLowerCase()))
                            .map((pg) => (
                              <button
                                key={pg.genre}
                                onClick={() => selectGenre(pg as unknown as GenreStat)}
                                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-[#262340] transition-colors cursor-pointer ${
                                  selectedGenre?.genre === pg.genre ? 'text-violet-300 bg-[#262340]' : 'text-[#ede9f9]'
                                }`}
                              >
                                <div className="min-w-0">
                                  <span className="capitalize truncate block">{pg.genre}</span>
                                  <span className="text-xs text-[#6b6590]">{pg.subgenres.length} subgenre{pg.subgenres.length !== 1 ? 's' : ''}</span>
                                </div>
                                <span className="text-xs text-[#6b6590] shrink-0 ml-3">
                                  {pg.streams > 0 ? `${pg.streams.toLocaleString()}×` : `${pg.count} artists`}
                                </span>
                              </button>
                            ))
                        : genres
                            .filter((g) => !genreSearch || g.genre.toLowerCase().includes(genreSearch.toLowerCase()))
                            .map((g) => (
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
                            ))
                      }
                    </div>
                  </div>
                )}
              </div>

              {/* Genre content panel */}
              {selectedGenre && rightContent ? (
                <div className="bg-[#18162a] rounded-2xl border border-[#2e2b46] overflow-hidden">
                  {/* Genre header */}
                  <div className="px-4 pt-4 pb-3 border-b border-[#2e2b46]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="font-semibold text-violet-300 capitalize truncate">{selectedGenre.genre}</h3>
                        {(() => {
                          const pg = groupedGenres.find((g) => g.genre === selectedGenre.genre);
                          return pg && pg.subgenres.length > 1
                            ? <span className="text-xs bg-[#262340] text-violet-400 rounded-full px-2 py-0.5 shrink-0">{pg.subgenres.length} subgenres</span>
                            : null;
                        })()}
                      </div>
                      {viewMode === 'tracks' && rightContent && rightContent.sortedTracks.length > 0 && (
                        <SavePlaylistButton
                          trackIds={rightContent.sortedTracks.map((t) => t.trackId)}
                          playlistName={`${selectedGenre.genre} playlist`}
                        />
                      )}
                    </div>
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
    </>
  );

  return embedded ? inner : <div className="max-w-7xl mx-auto px-4 py-8">{inner}</div>;
}

function MetricCard({ label, value, description, invert }: { label: string; value: number; description: string; invert: boolean }) {
  const [showTip, setShowTip] = useState(false);
  const color = value >= 66
    ? invert ? 'text-orange-500' : 'text-violet-400'
    : value >= 33 ? 'text-blue-400'
    : 'text-[#6b6590]';

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
