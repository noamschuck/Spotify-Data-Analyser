import { useEffect, useState } from 'react';
import { useTimeRange } from '../context/TimeRangeContext';
import { getTopTracks, type SpotifyTrack } from '../spotify/api';
import { TimeRangePicker } from '../components/TimeRangePicker';
import { TrackCard } from '../components/TrackCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useHistory } from '../context/HistoryContext';

export function TopTracks() {
  const { timeRange } = useTimeRange();
  const { stats: historyData } = useHistory();
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortByStreams, setSortByStreams] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getTopTracks(timeRange)
      .then(setTracks)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [timeRange]);

  // Build a map from trackId → history stream count
  const historyStreamMap = new Map(
    (historyData?.topTracks ?? []).map((t) => [t.trackId, t.streams])
  );

  const displayedTracks = historyData && sortByStreams
    ? [...tracks].sort((a, b) => {
        const aS = historyStreamMap.get(a.id) ?? -1;
        const bS = historyStreamMap.get(b.id) ?? -1;
        return bS - aS;
      })
    : tracks;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-violet-200">Top Tracks</h1>
        <div className="flex items-center gap-3 flex-wrap">
          {historyData && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6b6590]">Sort by:</span>
              <div className="inline-flex rounded-xl bg-[#262340] p-1 gap-1">
                <button
                  onClick={() => setSortByStreams(false)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    !sortByStreams ? 'bg-[#18162a] text-violet-300 shadow-sm shadow-black' : 'text-violet-400'
                  }`}
                >
                  Spotify Ranking
                </button>
                <button
                  onClick={() => setSortByStreams(true)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    sortByStreams ? 'bg-[#18162a] text-violet-300 shadow-sm shadow-black' : 'text-violet-400'
                  }`}
                >
                  Your Streams
                </button>
              </div>
            </div>
          )}
          <TimeRangePicker />
        </div>
      </div>

      <p className="text-xs text-[#6b6590] mb-6 leading-relaxed">
        Spotify's ranking weighs recent listening heavily — a song played last week ranks higher than one you played 200 times a year ago.
      </p>

      {loading && <LoadingSpinner message="Fetching your top tracks..." />}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && !error && (
        <div className="bg-[#18162a] rounded-2xl shadow-sm shadow-black border border-[#2e2b46] divide-y divide-[#2e2b46]">
          {displayedTracks.length === 0 ? (
            <p className="text-center text-[#6b6590] py-12 text-sm">
              No data for this time range yet.
            </p>
          ) : (
            displayedTracks.map((track, i) => (
              <TrackCard
                key={track.id}
                track={track}
                rank={i + 1}
                streams={historyStreamMap.get(track.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
