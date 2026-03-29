import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTimeRange } from '../context/TimeRangeContext';
import { useHistory } from '../context/HistoryContext';
import { getTopTracks, getTopArtists, getPlaylists, type SpotifyTrack, type SpotifyArtist } from '../spotify/api';
import { formatMs } from '../spotify/history';
import { TimeRangePicker } from '../components/TimeRangePicker';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function Dashboard() {
  const { user } = useAuth();
  const { timeRange } = useTimeRange();
  const { stats: historyStats } = useHistory();
  const [topTrack, setTopTrack] = useState<SpotifyTrack | null>(null);
  const [topArtist, setTopArtist] = useState<SpotifyArtist | null>(null);
  const [genreCount, setGenreCount] = useState<number>(0);
  const [playlistCount, setPlaylistCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const fetched = useRef<string | null>(null);

  useEffect(() => {
    if (fetched.current === timeRange) return;
    fetched.current = timeRange;
    setLoading(true);
    Promise.all([
      getTopTracks(timeRange, 1),
      getTopArtists(timeRange, 50),
      getPlaylists(),
    ])
      .then(([tracks, artists, playlists]) => {
        setTopTrack(tracks[0] ?? null);
        setTopArtist(artists[0] ?? null);
        const genres = new Set(artists.flatMap((a) => a.genres));
        setGenreCount(genres.size);
        setPlaylistCount(playlists.length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [timeRange]);

  const avatar = user?.images?.[0]?.url;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {avatar && (
            <img
              src={avatar}
              alt={user?.display_name}
              className="w-16 h-16 rounded-2xl ring-4 ring-[#3e3b5e] shadow-sm"
            />
          )}
          <div>
            <p className="text-sm text-violet-400 font-medium">Welcome back</p>
            <h1 className="text-3xl font-bold text-violet-200 tracking-tight">
              {user?.display_name}
            </h1>
          </div>
        </div>
        <TimeRangePicker />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Spotify stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Playlists" value={playlistCount} icon="≡" />
            <StatCard label="Unique Genres" value={genreCount} icon="◈" />
            <StatCard label="Top Track" value={topTrack?.name ?? '—'} icon="♪" small />
            <StatCard label="Top Artist" value={topArtist?.name ?? '—'} icon="★" small />
          </div>

          {/* History stats */}
          {historyStats ? (
            <div className="bg-gradient-to-r from-[#1f1d33] to-[#1a1f33] rounded-2xl p-5 border border-[#3e3b5e] mb-8">
              <p className="text-xs text-violet-400 font-semibold uppercase tracking-widest mb-3">
                From Your Streaming History
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Streams" value={historyStats.totalStreams.toLocaleString()} icon="▶" />
                <StatCard label="Time Listened" value={formatMs(historyStats.totalMsPlayed)} icon="◷" />
                <StatCard label="All-Time #1" value={historyStats.topTracks[0]?.trackName ?? '—'} icon="◆" small />
                <StatCard label="Top Artist" value={historyStats.topArtists[0]?.artistName ?? '—'} icon="★" small />
              </div>
            </div>
          ) : (
            <Link
              to="/history"
              className="flex items-center gap-3 bg-[#1f1d33] border border-[#2e2b46] border-dashed rounded-2xl p-4 mb-8 hover:bg-[#262340] transition-colors"
            >
              <span className="text-xl text-violet-400">◷</span>
              <div>
                <p className="text-sm font-semibold text-violet-400">Import your Streaming History</p>
                <p className="text-xs text-[#6b6590]">See real play counts, total listening time, and all-time stats</p>
              </div>
              <span className="ml-auto text-violet-400 text-sm">→</span>
            </Link>
          )}

          {/* Quick links */}
          <h2 className="text-lg font-semibold text-violet-300 mb-4">Explore</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <QuickLink to="/top-tracks" icon="♪" title="Top Tracks" desc="Your most played songs" />
            <QuickLink to="/top-artists" icon="★" title="Top Artists" desc="Artists you love most" />
            <QuickLink to="/taste" icon="◈" title="Music Taste" desc="Genre profile & eclecticism" />
            <QuickLink to="/playlists" icon="≡" title="Playlists" desc="All your playlists with stats" />
            <QuickLink to="/search" icon="⌕" title="Search" desc="Look up any track, artist, or album" />
            <QuickLink to="/history" icon="◷" title="Streaming History" desc="Import & explore your play counts" />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  small,
}: {
  label: string;
  value: string | number;
  icon: string;
  small?: boolean;
}) {
  return (
    <div className="bg-[#18162a] rounded-2xl p-4 shadow-sm shadow-black border border-[#2e2b46]">
      <div className="text-lg text-violet-400 mb-2 leading-none">{icon}</div>
      <p className="text-xs text-violet-400 font-medium mb-0.5">{label}</p>
      <p
        className={`font-bold text-violet-200 leading-tight ${
          small ? 'text-sm truncate' : 'text-2xl'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function QuickLink({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="bg-[#18162a] rounded-2xl p-5 shadow-sm shadow-black border border-[#2e2b46] hover:border-[#3e3b5e] hover:-translate-y-0.5 transition-all group"
    >
      <div className="text-xl text-violet-400 mb-3 leading-none">{icon}</div>
      <h3 className="font-semibold text-violet-300 group-hover:text-violet-400 transition-colors">
        {title}
      </h3>
      <p className="text-sm text-[#6b6590] mt-0.5">{desc}</p>
    </Link>
  );
}
