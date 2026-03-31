import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  searchSpotify,
  getTrack,
  getArtist,
  getArtistTopTracks,
  getAlbum,
  getAudioFeatures,
  getTopTracks,
  getTopArtists,
  getPlaylists,
  getPlaylistTracks,
  getPlaylistTrackIds,
  type SpotifyTrack,
  type SpotifyArtist,
  type SpotifyAlbum,
  type SpotifyPlaylist,
  type AudioFeatures,
} from '../spotify/api';
import { PopularityBar } from '../components/PopularityBar';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useHistory } from '../context/HistoryContext';
import { useTimeRange } from '../context/TimeRangeContext';
import { formatMs } from '../spotify/history';

type SearchType = 'track' | 'artist' | 'album';

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function FeatureBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-[#8a85ad] mb-1">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-[#2e2b46] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-400 to-blue-400 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const PAGE_NAMES: Record<string, string> = {
  '/top-tracks': 'Top Tracks',
  '/top-artists': 'Top Artists',
  '/top-albums': 'Top Albums',
  '/history': 'History',
  '/you': 'You',
  '/taste': 'Taste Analysis',
  '/forgotten-gems': 'Forgotten Gems',
};

function HourlyListeningChart({ hourlyStreams }: { hourlyStreams: number[] }) {
  const total = hourlyStreams.reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const data = hourlyStreams.map((count, h) => ({
    label: h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`,
    count,
  }));

  const peak = data.reduce((a, b) => (b.count > a.count ? b : a));
  const night = hourlyStreams.slice(0, 6).reduce((a, b) => a + b, 0);
  const morning = hourlyStreams.slice(6, 12).reduce((a, b) => a + b, 0);
  const afternoon = hourlyStreams.slice(12, 18).reduce((a, b) => a + b, 0);
  const evening = hourlyStreams.slice(18, 24).reduce((a, b) => a + b, 0);
  const periods = [
    { label: 'Night', value: night, icon: '🌙', color: '#4f46e5' },
    { label: 'Morn', value: morning, icon: '🌅', color: '#f59e0b' },
    { label: 'Aftn', value: afternoon, icon: '☀️', color: '#f97316' },
    { label: 'Eve', value: evening, icon: '🌆', color: '#a855f7' },
  ];

  return (
    <div className="bg-[#18162a] rounded-2xl border border-[#2e2b46] p-4">
      <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-0.5">When You Listen</p>
      <p className="text-xs text-[#6b6590] mb-3">Peak: {peak.label} · {peak.count} plays</p>
      <ResponsiveContainer width="100%" height={72}>
        <BarChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} barCategoryGap="8%">
          <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#6b6590' }} tickLine={false} axisLine={false} interval={5} />
          <Tooltip
            contentStyle={{ background: '#0d0b1a', border: '1px solid #2e2b46', borderRadius: 8, fontSize: 11, padding: '4px 8px' }}
            formatter={(v) => [`${v}×`, '']}
            labelFormatter={(l) => String(l)}
            cursor={{ fill: 'rgba(124,58,237,0.1)' }}
          />
          <Bar dataKey="count" radius={[2, 2, 0, 0]} fill="#7c3aed" />
        </BarChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-4 gap-1 mt-2">
        {periods.map(({ label, value, icon, color }) => (
          <div key={label} className="text-center">
            <p className="text-xs font-semibold" style={{ color }}>{Math.round((value / total) * 100)}%</p>
            <p className="text-[10px] text-[#6b6590]">{icon} {label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoBadge({ emoji, text, positive }: { emoji: string; text: string; positive?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${
        positive ? 'bg-[#1f1d33] text-violet-300' : 'bg-[#1f1d33] text-[#8a85ad]'
      }`}
    >
      <span>{emoji}</span>
      <span>{text}</span>
    </div>
  );
}

// ── Track detail ──────────────────────────────────────────────────────────

function TrackDetail({ id }: { id: string }) {
  const { getTrackStats } = useHistory();
  const historyStats = getTrackStats(id);

  const [track, setTrack] = useState<SpotifyTrack | null>(null);
  const [features, setFeatures] = useState<AudioFeatures | null>(null);
  const [topRank, setTopRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [inPlaylists, setInPlaylists] = useState<string[] | null>(null);
  const [checkingPlaylists, setCheckingPlaylists] = useState(false);

  useEffect(() => {
    setLoading(true);
    setInPlaylists(null);

    // Main track data — fast parallel load
    Promise.all([
      getTrack(id),
      getAudioFeatures(id),
      getTopTracks('short_term').catch(() => [] as SpotifyTrack[]),
      getTopTracks('medium_term').catch(() => [] as SpotifyTrack[]),
      getTopTracks('long_term').catch(() => [] as SpotifyTrack[]),
    ])
      .then(([t, feat, st, mt, lt]) => {
        setTrack(t as SpotifyTrack);
        setFeatures(feat as AudioFeatures | null);
        const allTop = [
          ...(st as SpotifyTrack[]).map((tr, i) => ({ tr, rank: i + 1 })),
          ...(mt as SpotifyTrack[]).map((tr, i) => ({ tr, rank: i + 1 })),
          ...(lt as SpotifyTrack[]).map((tr, i) => ({ tr, rank: i + 1 })),
        ];
        const match = allTop.find((x) => x.tr.id === id);
        if (match) setTopRank(match.rank);
      })
      .finally(() => setLoading(false));

    // Playlist check runs in parallel — doesn't block main load
    setCheckingPlaylists(true);
    (async () => {
      try {
        const pls = await getPlaylists();
        const found: string[] = [];
        for (let i = 0; i < pls.length; i += 10) {
          const batch = pls.slice(i, i + 10);
          const results = await Promise.all(
            batch.map(async (pl: SpotifyPlaylist) => {
              try {
                const ids = await getPlaylistTrackIds(pl.id);
                return ids.includes(id) ? pl.name : null;
              } catch { return null; }
            })
          );
          found.push(...results.filter((r): r is string => r !== null));
        }
        setInPlaylists(found);
      } catch {
        setInPlaylists([]);
      } finally {
        setCheckingPlaylists(false);
      }
    })();
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (!track) return <p className="text-red-400 text-sm">Track not found.</p>;

  const image = track.album.images?.[0]?.url;

  return (
    <div className="space-y-4">
      <div className="flex gap-5">
        {image && <img src={image} alt={track.name} className="w-28 h-28 rounded-2xl shadow-md" />}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-violet-200 truncate">{track.name}</h2>
          <p className="text-[#a09bc0] text-sm">{track.artists.map((a) => a.name).join(', ')}</p>
          <p className="text-[#6b6590] text-xs mt-0.5">{track.album.name} · {track.album.release_date?.slice(0, 4)}</p>
          <p className="text-[#6b6590] text-xs">{formatDuration(track.duration_ms)}{track.explicit ? ' · Explicit' : ''}</p>
          <div className="mt-2">
            <PopularityBar value={track.popularity} label="Popularity" />
          </div>
        </div>
      </div>

      {/* History stats */}
      {historyStats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#1f1d33] rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-violet-400">{historyStats.streams}×</p>
            <p className="text-xs text-[#8a85ad]">streams</p>
          </div>
          <div className="bg-[#1a1f33] rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-blue-400">{formatMs(historyStats.msPlayed)}</p>
            <p className="text-xs text-[#8a85ad]">total time</p>
          </div>
          <div className="bg-[#1a1b33] rounded-xl p-3 text-center">
            {(() => {
              const d = historyStats.firstPlayed ? new Date(historyStats.firstPlayed.replace(' ', 'T')) : null;
              return <p className="text-xs font-bold text-indigo-400">{d && !isNaN(d.getTime()) ? d.toLocaleDateString() : 'Re-import history'}</p>;
            })()}
            <p className="text-xs text-[#8a85ad]">first played</p>
          </div>
          <div className="bg-[#1f1d33] rounded-xl p-3 text-center">
            {(() => {
              const d = historyStats.lastPlayed ? new Date(historyStats.lastPlayed.replace(' ', 'T')) : null;
              return <p className="text-xs font-bold text-purple-400">{d && !isNaN(d.getTime()) ? d.toLocaleDateString() : 'Re-import history'}</p>;
            })()}
            <p className="text-xs text-[#8a85ad]">last played</p>
          </div>
        </div>
      ) : (
        <InfoBadge emoji="📊" text="Import your Extended Streaming History to see play counts" />
      )}

      {historyStats?.hourlyStreams && historyStats.hourlyStreams.some((v) => v > 0) && (
        <HourlyListeningChart hourlyStreams={historyStats.hourlyStreams} />
      )}

      {topRank ? (
        <InfoBadge emoji="🏆" text={`In your top tracks (rank #${topRank})`} positive />
      ) : (
        <InfoBadge emoji="—" text="Not in your top 50 tracks" />
      )}

      {/* Playlist check — runs automatically */}
      {checkingPlaylists ? (
        <div className="flex items-center gap-2 text-xs text-[#6b6590] bg-[#1f1d33] rounded-xl px-3 py-2">
          <div className="w-3 h-3 border border-[#3e3b5e] border-t-violet-500 rounded-full animate-spin shrink-0" />
          Checking playlists…
        </div>
      ) : inPlaylists !== null && inPlaylists.length > 0 ? (
        <div className="bg-[#1f1d33] rounded-xl p-3">
          <p className="text-xs font-semibold text-violet-400 mb-1">In {inPlaylists.length} of your playlists</p>
          <p className="text-xs text-[#8a85ad]">{inPlaylists.join(', ')}</p>
        </div>
      ) : inPlaylists !== null ? (
        <InfoBadge emoji="📋" text="Not in any of your playlists" />
      ) : null}

      {features && (
        <div className="bg-[#18162a] rounded-2xl p-4 border border-[#2e2b46] space-y-3">
          <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest">Audio Features</p>
          <FeatureBar label="Danceability" value={features.danceability} />
          <FeatureBar label="Energy" value={features.energy} />
          <FeatureBar label="Valence (Happiness)" value={features.valence} />
          <FeatureBar label="Acousticness" value={features.acousticness} />
          <FeatureBar label="Instrumentalness" value={features.instrumentalness} />
          <div className="text-xs text-[#6b6590]">Tempo: {Math.round(features.tempo)} BPM</div>
        </div>
      )}
    </div>
  );
}

// ── Artist detail ─────────────────────────────────────────────────────────

function ArtistDetail({ id }: { id: string }) {
  const { stats: historyData } = useHistory();
  const { timeRange } = useTimeRange();

  const [artist, setArtist] = useState<SpotifyArtist | null>(null);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [topRank, setTopRank] = useState<number | null>(null);
  const [timeRangeTracks, setTimeRangeTracks] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRareTracks, setShowRareTracks] = useState(false);

  // Playlist check runs lazily
  const [playlistTrackCount, setPlaylistTrackCount] = useState<number | null>(null);
  const [checkingPlaylists, setCheckingPlaylists] = useState(false);

  useEffect(() => {
    setLoading(true);
    setPlaylistTrackCount(null);
    setTimeRangeTracks([]);

    Promise.all([
      getArtist(id),
      getArtistTopTracks(id),
      getTopArtists('short_term').catch(() => [] as SpotifyArtist[]),
      getTopArtists('medium_term').catch(() => [] as SpotifyArtist[]),
      getTopArtists('long_term').catch(() => [] as SpotifyArtist[]),
      getTopTracks(timeRange).catch(() => [] as SpotifyTrack[]),
    ])
      .then(([a, tt, sa, ma, la, trt]) => {
        setArtist(a as SpotifyArtist);
        setTopTracks((tt as SpotifyTrack[]).slice(0, 5));

        const allTop = [
          ...(sa as SpotifyArtist[]).map((ar, i) => ({ ar, rank: i + 1 })),
          ...(ma as SpotifyArtist[]).map((ar, i) => ({ ar, rank: i + 1 })),
          ...(la as SpotifyArtist[]).map((ar, i) => ({ ar, rank: i + 1 })),
        ];
        const match = allTop.find((x) => x.ar.id === id);
        if (match) setTopRank(match.rank);

        // Tracks from this artist in the current time range
        const artistTimeRangeTracks = (trt as SpotifyTrack[]).filter((t) =>
          t.artists.some((ar) => ar.id === id)
        );
        setTimeRangeTracks(artistTimeRangeTracks);
      })
      .finally(() => setLoading(false));
  }, [id, timeRange]);

  async function checkPlaylists() {
    setCheckingPlaylists(true);
    try {
      const pls = await getPlaylists();
      let count = 0;
      for (let i = 0; i < Math.min(pls.length, 30); i += 5) {
        const batch = pls.slice(i, i + 5);
        const results = await Promise.all(
          batch.map(async (pl: SpotifyPlaylist) => {
            try {
              const tracks = await getPlaylistTracks(pl.id);
              return tracks.filter((t) => t.artists.some((ar) => ar.id === id)).length;
            } catch { return 0; }
          })
        );
        count += results.reduce((a, b) => a + b, 0);
      }
      setPlaylistTrackCount(count);
    } finally {
      setCheckingPlaylists(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (!artist) return <p className="text-red-400 text-sm">Artist not found.</p>;

  const image = artist.images?.[0]?.url;

  // History stats matched by artist name
  const historyArtist = historyData?.topArtists.find(
    (a) => a.artistName.toLowerCase() === artist.name.toLowerCase()
  );

  const artistHistoryTracks = historyData?.topTracks.filter(
    (t) => t.artistName.toLowerCase() === artist.name.toLowerCase()
  ) ?? [];
  const mainTracks = artistHistoryTracks.filter((t) => t.streams >= 3).sort((a, b) => b.streams - a.streams);
  const rareTracks = artistHistoryTracks.filter((t) => t.streams < 3).sort((a, b) => b.streams - a.streams);

  const timeRangeLabel = timeRange === 'short_term' ? 'last 4 weeks' : timeRange === 'medium_term' ? 'last 6 months' : 'all time';

  return (
    <div className="space-y-4">
      <div className="flex gap-5">
        {image ? (
          <img src={image} alt={artist.name} className="w-28 h-28 rounded-full shadow-md object-cover" />
        ) : (
          <div className="w-28 h-28 rounded-full bg-[#262340] flex items-center justify-center shadow-md">
            <span className="text-5xl">🎤</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-violet-200">{artist.name}</h2>
          <p className="text-[#6b6590] text-xs mt-0.5">
            {artist.followers.total.toLocaleString()} followers
          </p>
          {historyArtist && (
            <p className="text-xs text-violet-400 font-semibold mt-0.5">
              {historyArtist.streams.toLocaleString()} streams · {formatMs(historyArtist.msPlayed)}
            </p>
          )}
          {timeRangeTracks.length > 0 && (
            <p className="text-xs text-blue-400 mt-0.5">
              {timeRangeTracks.length} song{timeRangeTracks.length !== 1 ? 's' : ''} in your top ({timeRangeLabel})
            </p>
          )}
          <div className="flex flex-wrap gap-1 mt-2">
            {artist.genres.slice(0, 5).map((g) => (
              <span key={g} className="text-xs bg-[#262340] text-violet-300 rounded-full px-2 py-0.5">
                {g}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* History stats */}
      {historyArtist ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#1f1d33] rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-violet-400">{historyArtist.streams.toLocaleString()}×</p>
            <p className="text-xs text-[#8a85ad]">streams</p>
          </div>
          <div className="bg-[#1a1f33] rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-blue-400">{formatMs(historyArtist.msPlayed)}</p>
            <p className="text-xs text-[#8a85ad]">total time</p>
          </div>
          <div className="bg-[#1a1b33] rounded-xl p-3 text-center">
            {(() => {
              const d = historyArtist.firstPlayed ? new Date(historyArtist.firstPlayed.replace(' ', 'T')) : null;
              return <p className="text-xs font-bold text-indigo-400">{d && !isNaN(d.getTime()) ? d.toLocaleDateString() : 'Re-import history'}</p>;
            })()}
            <p className="text-xs text-[#8a85ad]">first streamed</p>
          </div>
          <div className="bg-[#1f1d33] rounded-xl p-3 text-center">
            <p className="text-xs font-bold text-purple-400">{mainTracks.length} tracks</p>
            <p className="text-xs text-[#8a85ad]">in your history</p>
          </div>
        </div>
      ) : (
        <InfoBadge emoji="📊" text="Import your Extended Streaming History to see stream counts" />
      )}

      {historyArtist?.hourlyStreams && historyArtist.hourlyStreams.some((v) => v > 0) && (
        <HourlyListeningChart hourlyStreams={historyArtist.hourlyStreams} />
      )}

      {topRank ? (
        <InfoBadge emoji="🏆" text={`In your top artists (rank #${topRank})`} positive />
      ) : (
        <InfoBadge emoji="—" text="Not in your top 50 artists" />
      )}

      {/* Lazy playlist check */}
      {playlistTrackCount === null ? (
        <button
          onClick={() => void checkPlaylists()}
          disabled={checkingPlaylists}
          className="w-full text-sm text-violet-400 bg-[#1f1d33] hover:bg-[#262340] rounded-xl py-2 transition-colors cursor-pointer disabled:opacity-50"
        >
          {checkingPlaylists ? 'Checking playlists…' : '🔍 Check how many of their tracks are in your playlists'}
        </button>
      ) : playlistTrackCount > 0 ? (
        <InfoBadge emoji="📋" text={`${playlistTrackCount} of their tracks are in your playlists`} positive />
      ) : (
        <InfoBadge emoji="📋" text="None of their tracks found in your playlists (checked first 30)" />
      )}

      {/* Your listening history — main tracks (≥3 streams) */}
      {mainTracks.length > 0 && (
        <div className="bg-[#18162a] rounded-2xl border border-[#2e2b46] overflow-hidden">
          <div className="p-4 pb-2">
            <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest">Your Listening History</p>
            <p className="text-xs text-[#6b6590]">{mainTracks.length} tracks · sorted by your plays</p>
          </div>
          {mainTracks.map((t, i) => (
            <div key={t.trackId} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#1f1d33] transition-colors border-t border-[#2e2b46]">
              <span className="text-xs text-violet-300 w-5 text-right shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#ede9f9] truncate">{t.trackName}</p>
                <p className="text-xs text-[#6b6590]">{t.albumName}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-violet-400">{t.streams}×</p>
                <p className="text-xs text-[#6b6590]">{formatMs(t.msPlayed)}</p>
              </div>
            </div>
          ))}

          {/* Rare tracks — collapsed by default */}
          {rareTracks.length > 0 && (
            <div className="border-t border-[#2e2b46]">
              <button
                onClick={() => setShowRareTracks((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-[#6b6590] hover:text-violet-400 hover:bg-[#1f1d33] transition-colors cursor-pointer"
              >
                <span>{rareTracks.length} track{rareTracks.length !== 1 ? 's' : ''} listened to under 3 times</span>
                <span className={`transition-transform ${showRareTracks ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {showRareTracks && rareTracks.map((t) => (
                <div key={t.trackId} className="flex items-center gap-3 px-4 py-2 hover:bg-[#1f1d33] transition-colors border-t border-[#2e2b46]">
                  <span className="text-xs text-[#4a4670] w-5 text-right shrink-0">—</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#8a85ad] truncate">{t.trackName}</p>
                    <p className="text-xs text-[#4a4670]">{t.albumName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-[#6b6590]">{t.streams}×</p>
                    <p className="text-xs text-[#4a4670]">{formatMs(t.msPlayed)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Spotify top tracks — always shown */}
      {topTracks.length > 0 && (
        <div className="bg-[#18162a] rounded-2xl border border-[#2e2b46] overflow-hidden">
          <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest p-4 pb-2">Spotify Top Tracks</p>
          {topTracks.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-2 hover:bg-[#1f1d33] transition-colors border-t border-[#2e2b46]">
              <img src={t.album.images?.[0]?.url} alt={t.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#ede9f9] truncate">{t.name}</p>
                <div className="mt-1"><PopularityBar value={t.popularity} /></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Album detail ──────────────────────────────────────────────────────────

function AlbumDetail({ id }: { id: string }) {
  const { stats: historyData } = useHistory();

  const [album, setAlbum] = useState<(SpotifyAlbum & { tracks: { items: SpotifyTrack[] } }) | null>(null);
  const [topTrackIds, setTopTrackIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getAlbum(id),
      getTopTracks('short_term').catch(() => [] as SpotifyTrack[]),
      getTopTracks('medium_term').catch(() => [] as SpotifyTrack[]),
      getTopTracks('long_term').catch(() => [] as SpotifyTrack[]),
    ])
      .then(([a, st, mt, lt]) => {
        setAlbum(a as SpotifyAlbum & { tracks: { items: SpotifyTrack[] } });
        setTopTrackIds(new Set([
          ...(st as SpotifyTrack[]).map((t) => t.id),
          ...(mt as SpotifyTrack[]).map((t) => t.id),
          ...(lt as SpotifyTrack[]).map((t) => t.id),
        ]));
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (!album) return <p className="text-red-400 text-sm">Album not found.</p>;

  const image = album.images?.[0]?.url;
  const tracks = album.tracks?.items ?? [];

  // History: find which tracks from this album have been played
  const historyTrackMap = new Map(
    (historyData?.topTracks ?? []).map((t) => [t.trackId, t])
  );

  const totalAlbumStreams = tracks.reduce(
    (s, t) => s + (historyTrackMap.get(t.id)?.streams ?? 0), 0
  );

  const albumHourly = new Array(24).fill(0) as number[];
  for (const t of tracks) {
    const ht = historyTrackMap.get(t.id);
    if (ht?.hourlyStreams) {
      ht.hourlyStreams.forEach((v, h) => { albumHourly[h] += v; });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-5">
        {image && <img src={image} alt={album.name} className="w-28 h-28 rounded-2xl shadow-md" />}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-violet-200 truncate">{album.name}</h2>
          <p className="text-[#a09bc0] text-sm">{album.artists.map((a) => a.name).join(', ')}</p>
          <p className="text-[#6b6590] text-xs mt-0.5">
            {album.release_date?.slice(0, 4)} · {album.total_tracks} tracks
          </p>
          {totalAlbumStreams > 0 && (
            <p className="text-xs text-violet-500 font-semibold mt-1">
              {totalAlbumStreams}× streamed total
            </p>
          )}
        </div>
      </div>

      {albumHourly.some((v) => v > 0) && (
        <HourlyListeningChart hourlyStreams={albumHourly} />
      )}

      <div className="bg-[#18162a] rounded-2xl border border-[#2e2b46] overflow-hidden">
        <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest p-4 pb-2">Tracks</p>
        {tracks.map((t, i) => {
          const inTop = topTrackIds.has(t.id);
          const histTrack = historyTrackMap.get(t.id);
          return (
            <div
              key={t.id}
              className={`flex items-center gap-3 px-4 py-2 transition-colors ${
                inTop || histTrack ? 'bg-[#1f1d33]' : 'hover:bg-[#1f1d33]'
              }`}
            >
              <span className="text-xs text-[#6b6590] w-5 text-right shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#ede9f9] truncate">{t.name}</p>
                <div className="flex gap-2 mt-0.5">
                  {inTop && (
                    <span className="text-xs text-violet-300 bg-[#262340] rounded-full px-1.5 py-0.5">
                      In your top tracks
                    </span>
                  )}
                </div>
              </div>
              {histTrack ? (
                <span className="text-xs font-semibold text-violet-400 shrink-0">
                  {histTrack.streams}× · {formatMs(histTrack.msPlayed)}
                </span>
              ) : (
                <span className="text-xs text-[#6b6590] shrink-0">{formatDuration(t.duration_ms)}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Search result rows ────────────────────────────────────────────────────

function ResultRow({
  image,
  title,
  sub,
  type,
  onClick,
  round,
}: {
  image?: string;
  title: string;
  sub: string;
  type: string;
  onClick: () => void;
  round?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#1f1d33] transition-colors text-left cursor-pointer"
    >
      {image ? (
        <img
          src={image}
          alt={title}
          className={`w-12 h-12 object-cover shrink-0 shadow-sm ${round ? 'rounded-full' : 'rounded-lg'}`}
        />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-[#262340] flex items-center justify-center shrink-0">
          <span className="text-xl">🎵</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-[#ede9f9] truncate">{title}</p>
        <p className="text-xs text-[#6b6590] truncate">{sub}</p>
      </div>
      <span className="text-xs bg-[#262340] text-violet-300 rounded-full px-2 py-0.5 shrink-0">
        {type}
      </span>
    </button>
  );
}

// ── Main Search page ──────────────────────────────────────────────────────

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{
    tracks: SpotifyTrack[];
    artists: SpotifyArtist[];
    albums: SpotifyAlbum[];
  }>({ tracks: [], artists: [], albums: [] });
  const [searching, setSearching] = useState(false);
  const [resultTab, setResultTab] = useState<'tracks' | 'artists' | 'albums'>('tracks');
  const [selectedType, setSelectedType] = useState<SearchType | null>(
    searchParams.get('type') as SearchType | null
  );
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('id'));

  const doSearch = useCallback(async (q: string, preferTab?: SearchType) => {
    if (!q.trim()) return;
    setSearching(true);
    setSelectedType(null);
    setSelectedId(null);
    try {
      const data = await searchSpotify(q, ['track', 'artist', 'album']);
      const tracks = data.tracks?.items ?? [];
      const artists = data.artists?.items ?? [];
      const albums = data.albums?.items ?? [];
      setResults({ tracks, artists, albums });
      // Pick tab: prefer explicit hint, else whichever category has results
      if (preferTab) {
        setResultTab(preferTab === 'track' ? 'tracks' : preferTab === 'artist' ? 'artists' : 'albums');
      } else if (tracks.length > 0) {
        setResultTab('tracks');
      } else if (artists.length > 0) {
        setResultTab('artists');
      } else {
        setResultTab('albums');
      }
    } finally {
      setSearching(false);
    }
  }, []);

  // Auto-search when arriving with ?q= param (e.g. clicking an artist name from history)
  useEffect(() => {
    const q = searchParams.get('q');
    const preferType = searchParams.get('preferType') as SearchType | null;
    if (q) {
      setQuery(q);
      void doSearch(q, preferType ?? undefined);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const type = searchParams.get('type') as SearchType | null;
    const id = searchParams.get('id');
    if (type && id) {
      setSelectedType(type);
      setSelectedId(id);
    }
  }, [searchParams]);

  function selectItem(type: SearchType, id: string) {
    setSelectedType(type);
    setSelectedId(id);
    setSearchParams({ type, id });
  }

  function clearDetail() {
    if (from) {
      navigate(from);
    } else {
      setSelectedType(null);
      setSelectedId(null);
      setSearchParams({});
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-violet-200 mb-6">Search</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void doSearch(query);
        }}
        className="flex gap-2 mb-6"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tracks, artists, albums..."
          className="flex-1 bg-[#13112a] border border-[#3e3b5e] rounded-xl px-4 py-2.5 text-sm text-[#ede9f9] placeholder-[#6b6590] focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        />
        <button
          type="submit"
          className="bg-gradient-to-r from-violet-500 to-blue-500 text-white font-medium px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity cursor-pointer"
        >
          Search
        </button>
      </form>

      {selectedType && selectedId ? (
        <div className="bg-[#18162a] rounded-2xl p-6 shadow-sm shadow-black border border-[#2e2b46]">
          <button
            onClick={clearDetail}
            className="text-xs text-violet-400 hover:text-violet-300 mb-4 flex items-center gap-1 cursor-pointer"
          >
            ← {from ? `Back to ${PAGE_NAMES[from] ?? 'previous page'}` : 'Back to results'}
          </button>
          {selectedType === 'track' && <TrackDetail id={selectedId} />}
          {selectedType === 'artist' && <ArtistDetail id={selectedId} />}
          {selectedType === 'album' && <AlbumDetail id={selectedId} />}
        </div>
      ) : (
        <>
          {searching && <LoadingSpinner message="Searching..." />}

          {!searching && (results.tracks.length > 0 || results.artists.length > 0 || results.albums.length > 0) && (
            <div className="bg-[#18162a] rounded-2xl shadow-sm shadow-black border border-[#2e2b46] overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b border-[#2e2b46]">
                {([
                  { key: 'tracks' as const, label: 'Tracks', count: results.tracks.length },
                  { key: 'artists' as const, label: 'Artists', count: results.artists.length },
                  { key: 'albums' as const, label: 'Albums', count: results.albums.length },
                ]).map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setResultTab(key)}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors cursor-pointer border-b-2 ${
                      resultTab === key
                        ? 'border-violet-500 text-violet-300'
                        : 'border-transparent text-[#6b6590] hover:text-violet-400'
                    }`}
                  >
                    {label}
                    {count > 0 && (
                      <span className={`text-xs rounded-full px-1.5 py-0.5 ${resultTab === key ? 'bg-violet-900/50 text-violet-300' : 'bg-[#262340] text-[#6b6590]'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Results for active tab */}
              <div className="divide-y divide-[#2e2b46]">
                {resultTab === 'tracks' && results.tracks.map((t) => (
                  <ResultRow
                    key={t.id}
                    image={t.album.images?.[0]?.url}
                    title={t.name}
                    sub={t.artists.map((a) => a.name).join(', ')}
                    type="track"
                    onClick={() => selectItem('track', t.id)}
                  />
                ))}
                {resultTab === 'artists' && results.artists.map((a) => (
                  <ResultRow
                    key={a.id}
                    image={a.images?.[0]?.url}
                    title={a.name}
                    sub={a.genres.slice(0, 2).join(', ') || 'Artist'}
                    type="artist"
                    onClick={() => selectItem('artist', a.id)}
                    round
                  />
                ))}
                {resultTab === 'albums' && results.albums.map((a) => (
                  <ResultRow
                    key={a.id}
                    image={a.images?.[0]?.url}
                    title={a.name}
                    sub={`${a.artists.map((ar) => ar.name).join(', ')} · ${a.release_date?.slice(0, 4)}`}
                    type="album"
                    onClick={() => selectItem('album', a.id)}
                  />
                ))}
                {((resultTab === 'tracks' && results.tracks.length === 0) ||
                  (resultTab === 'artists' && results.artists.length === 0) ||
                  (resultTab === 'albums' && results.albums.length === 0)) && (
                  <p className="text-center text-[#6b6590] text-sm py-8">No {resultTab} found.</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
