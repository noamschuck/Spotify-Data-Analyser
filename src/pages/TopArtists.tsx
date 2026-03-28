import { useEffect, useState } from 'react';
import { useTimeRange } from '../context/TimeRangeContext';
import { getTopArtists, type SpotifyArtist } from '../spotify/api';
import { TimeRangePicker } from '../components/TimeRangePicker';
import { ArtistCard } from '../components/ArtistCard';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function TopArtists() {
  const { timeRange } = useTimeRange();
  const [artists, setArtists] = useState<SpotifyArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getTopArtists(timeRange)
      .then(setArtists)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [timeRange]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-violet-200">Top Artists</h1>
        <TimeRangePicker />
      </div>

      {loading && <LoadingSpinner message="Fetching your top artists..." />}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && !error && (
        <div className="bg-[#18162a] rounded-2xl shadow-sm shadow-black border border-[#2e2b46] divide-y divide-[#2e2b46]">
          {artists.length === 0 ? (
            <p className="text-center text-[#6b6590] py-12 text-sm">
              No data for this time range yet.
            </p>
          ) : (
            artists.map((artist, i) => (
              <ArtistCard key={artist.id} artist={artist} rank={i + 1} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
