import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTopArtists, getTracksById, type SpotifyArtist, type SpotifyTrack } from '../spotify/api';
import { useHistory } from '../context/HistoryContext';
import { formatMs } from '../spotify/history';
import { LoadingSpinner } from '../components/LoadingSpinner';

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

function computeProfile(artists: SpotifyArtist[]): TasteProfile {
  const genreMap = new Map<string, number>();
  for (const a of artists) {
    for (const g of a.genres) genreMap.set(g, (genreMap.get(g) ?? 0) + 1);
  }
  const totalTags = [...genreMap.values()].reduce((s, v) => s + v, 0);
  const uniqueGenres = genreMap.size;
  const eclecticism = totalTags > 0
    ? Math.min(100, Math.round((uniqueGenres / Math.max(1, totalTags)) * 300))
    : 0;

  const sorted = [...genreMap.entries()].sort((a, b) => b[1] - a[1]);
  const top3 = sorted.slice(0, 3).reduce((s, [, v]) => s + v, 0);
  const focus = totalTags > 0 ? Math.round((top3 / totalTags) * 100) : 0;

  const avgPop = artists.length > 0
    ? artists.reduce((s, a) => s + a.popularity, 0) / artists.length
    : 50;
  const niche = Math.round(100 - avgPop);

  let label: string;
  let description: string;
  if (eclecticism >= 60 && niche >= 50) {
    label = 'Underground Explorer';
    description = "You dig deep across many genres, favouring artists the mainstream hasn't caught up with yet.";
  } else if (eclecticism >= 60) {
    label = 'Eclectic Listener';
    description = "Your taste spans a wide range of genres — you're hard to put in a box.";
  } else if (focus >= 70 && niche >= 50) {
    label = 'Niche Devotee';
    description = "You go all-in on a specific corner of the music world, and it's not mainstream.";
  } else if (focus >= 70) {
    label = 'Genre Purist';
    description = 'You know what you like and you stick with it — your taste is focused and consistent.';
  } else if (niche >= 60) {
    label = 'Indie Tastemaker';
    description = 'You tend to listen to artists flying under the radar before they blow up.';
  } else {
    label = 'Balanced Explorer';
    description = 'You mix popular picks with some genre variety — a well-rounded listener.';
  }

  return { eclecticism, focus, niche, label, description };
}

interface NichePick {
  trackId: string;
  trackName: string;
  artistName: string;
  streams: number;
  msPlayed: number;
  popularity: number;
}

export function You() {
  const { stats: historyData } = useHistory();
  const [artists, setArtists] = useState<SpotifyArtist[]>([]);
  const [profile, setProfile] = useState<TasteProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [showAllProfiles, setShowAllProfiles] = useState(false);

  const [nichePicks, setNichePicks] = useState<NichePick[] | null>(null);
  const [loadingNiche, setLoadingNiche] = useState(false);

  // Fetch artists for taste profile
  useEffect(() => {
    setLoadingProfile(true);
    const ranges = ['short_term', 'medium_term', 'long_term'] as const;
    Promise.all(ranges.map((r) => getTopArtists(r).catch(() => [] as SpotifyArtist[])))
      .then((results) => {
        const seen = new Map<string, SpotifyArtist>();
        for (const arr of results) {
          for (const a of arr) if (!seen.has(a.id)) seen.set(a.id, a);
        }
        const merged = [...seen.values()];
        setArtists(merged);
        // Use medium_term for profile
        setProfile(computeProfile(results[1].length > 0 ? results[1] : merged));
      })
      .finally(() => setLoadingProfile(false));
  }, []);

  // Fetch niche picks: top 100 history tracks → batch fetch popularity → sort by lowest popularity
  useEffect(() => {
    if (!historyData || historyData.topTracks.length === 0) return;
    setLoadingNiche(true);
    const top100 = historyData.topTracks.slice(0, 100);
    const ids = top100.map((t) => t.trackId);
    getTracksById(ids)
      .then((spotifyTracks) => {
        const popularityMap = new Map<string, number>(spotifyTracks.map((t) => [t.id, t.popularity]));
        const picks: NichePick[] = top100
          .map((t) => ({
            trackId: t.trackId,
            trackName: t.trackName,
            artistName: t.artistName,
            streams: t.streams,
            msPlayed: t.msPlayed,
            popularity: popularityMap.get(t.trackId) ?? 50,
          }))
          .filter((t) => popularityMap.has(t.trackId)) // only include tracks we got data for
          .sort((a, b) => a.popularity - b.popularity); // lowest popularity first
        setNichePicks(picks.slice(0, 30));
      })
      .catch(() => setNichePicks([]))
      .finally(() => setLoadingNiche(false));
  }, [historyData]);

  const metricColor = (v: number, invert: boolean) =>
    v >= 66
      ? invert ? 'text-orange-400' : 'text-violet-400'
      : v >= 33
      ? 'text-blue-400'
      : invert ? 'text-green-400' : 'text-[#6b6590]';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-violet-200">You</h1>

      {/* Data source note */}
      <div className="text-xs text-[#6b6590] bg-[#18162a] border border-[#2e2b46] rounded-xl px-4 py-2.5">
        {historyData
          ? `All listen counts and personal stats come from your imported Extended Streaming History (${historyData.entryCount.toLocaleString()} raw entries). Artist/track metadata (genres, popularity) comes from Spotify.`
          : 'Import your Extended Streaming History for accurate personal stats. Currently showing Spotify API data only.'}
      </div>

      {/* Taste Profile */}
      {loadingProfile ? (
        <LoadingSpinner message="Computing your taste profile..." />
      ) : profile ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-violet-300">Your Taste Profile</h2>

          {/* Profile card */}
          <div
            className="bg-gradient-to-br from-[#1f1d33] to-[#1a1f33] rounded-2xl p-6 border border-[#3e3b5e] relative cursor-pointer select-none"
            onClick={() => setShowAllProfiles((v) => !v)}
          >
            <p className="text-xs text-violet-400 font-semibold uppercase tracking-widest mb-1">Your Label</p>
            <h3 className="text-2xl font-bold text-violet-300 mb-1">{profile.label}</h3>
            <p className="text-[#a09bc0] text-sm leading-relaxed">{profile.description}</p>
            <p className="text-xs text-[#6b6590] mt-2">Click to see all possible profiles</p>

            {showAllProfiles && (
              <div className="mt-4 pt-4 border-t border-[#3e3b5e] space-y-2">
                {ALL_PROFILES.map((p) => (
                  <div
                    key={p.label}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
                      p.label === profile.label ? 'bg-violet-900/40 border border-violet-700/40' : ''
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-semibold ${p.label === profile.label ? 'text-violet-300' : 'text-[#a09bc0]'}`}>
                          {p.label}
                        </p>
                        {p.label === profile.label && (
                          <span className="text-xs bg-violet-700/50 text-violet-300 px-1.5 py-0.5 rounded-full">you</span>
                        )}
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
            {[
              { label: 'Eclecticism', value: profile.eclecticism, desc: 'Genre variety', invert: false },
              { label: 'Focus', value: profile.focus, desc: '% in top 3 genres', invert: true },
              { label: 'Niche Score', value: profile.niche, desc: 'How underground', invert: false },
            ].map(({ label, value, desc, invert }) => (
              <div key={label} className="bg-[#18162a] rounded-2xl p-5 border border-[#2e2b46] text-center">
                <p className={`text-4xl font-bold mb-1 ${metricColor(value, invert)}`}>{value}</p>
                <p className="text-sm font-semibold text-violet-300">{label}</p>
                <p className="text-xs text-[#6b6590] mt-0.5">{desc}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-[#6b6590]">
            {historyData
              ? <>Based on {historyData.uniqueArtistCount?.toLocaleString() ?? artists.length} artists from your streaming history (genre data from Spotify's top {artists.length} artists). </>
              : <>Based on {artists.length} artists from Spotify's top 50 per range. </>}
            Visit{' '}
            <Link to="/taste" className="text-violet-400 hover:text-violet-300 underline">Music Taste</Link>{' '}
            for the full genre breakdown.
          </p>
        </section>
      ) : null}

      {/* Niche Picks */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-violet-300">Your Most Unique Tracks</h2>
          <p className="text-xs text-[#6b6590] mt-0.5">
            {historyData
              ? 'Your most-played tracks ranked by how underground they are (lowest Spotify popularity first).'
              : 'Import your history to see your niche picks.'}
          </p>
        </div>

        {loadingNiche && <LoadingSpinner message="Fetching track popularity..." />}

        {nichePicks && nichePicks.length > 0 && (
          <div className="bg-[#18162a] rounded-2xl shadow-sm shadow-black border border-[#2e2b46] overflow-hidden">
            <div className="divide-y divide-[#2e2b46]">
              {nichePicks.map((t, i) => (
                <div key={t.trackId} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-sm font-bold text-violet-200 w-6 text-right shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <Link to={`/search?type=track&id=${t.trackId}`} className="text-sm font-medium text-[#ede9f9] hover:text-violet-300 truncate block">{t.trackName}</Link>
                    <Link to={`/search?q=${encodeURIComponent(t.artistName)}`} className="text-xs text-[#6b6590] hover:text-violet-400 truncate block">{t.artistName}</Link>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-[#6b6590]">popularity</p>
                      <p className="text-sm font-semibold text-indigo-400">{t.popularity}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-violet-400">{t.streams}×</p>
                      <p className="text-xs text-[#6b6590]">{formatMs(t.msPlayed)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {nichePicks && nichePicks.length === 0 && !loadingNiche && (
          <p className="text-sm text-[#6b6590]">No niche picks found.</p>
        )}

        {!historyData && !loadingNiche && (
          <p className="text-sm text-[#6b6590]">
            <a href="/history" className="text-violet-400 hover:text-violet-300 underline">Import your history</a> to see your most unique tracks.
          </p>
        )}
      </section>
    </div>
  );
}
