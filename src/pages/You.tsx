import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getTracksById } from '../spotify/api';
import { useHistory } from '../context/HistoryContext';
import { formatMs } from '../spotify/history';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { TasteAnalysis } from './TasteAnalysis';


interface NichePick {
  trackId: string;
  trackName: string;
  artistName: string;
  streams: number;
  msPlayed: number;
  popularity: number;
}

export function You() {
  const location = useLocation();
  const { stats: historyData } = useHistory();
  const [nichePicks, setNichePicks] = useState<NichePick[] | null>(null);
  const [loadingNiche, setLoadingNiche] = useState(false);

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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-violet-200">You</h1>

      {/* Data source note */}
      <div className="text-xs text-[#6b6590] bg-[#18162a] border border-[#2e2b46] rounded-xl px-4 py-2.5">
        {historyData
          ? `All listen counts and personal stats come from your imported Extended Streaming History (${historyData.entryCount.toLocaleString()} raw entries). Artist/track metadata (genres, popularity) comes from Spotify.`
          : 'Import your Extended Streaming History for accurate personal stats. Currently showing Spotify API data only.'}
      </div>

      {/* Music Taste — full embedded view */}
      <section>
        <h2 className="text-lg font-semibold text-violet-300 mb-4">Music Taste</h2>
        <TasteAnalysis embedded />
      </section>

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
                    <Link to={`/search?type=track&id=${t.trackId}`} state={{ from: location.pathname }} className="text-sm font-medium text-[#ede9f9] hover:text-violet-300 truncate block">{t.trackName}</Link>
                    <Link to={`/search?q=${encodeURIComponent(t.artistName)}`} state={{ from: location.pathname }} className="text-xs text-[#6b6590] hover:text-violet-400 truncate block">{t.artistName}</Link>
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
