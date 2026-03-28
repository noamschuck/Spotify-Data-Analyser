import { Link } from 'react-router-dom';
import type { SpotifyTrack } from '../spotify/api';
import { PopularityBar } from './PopularityBar';

interface Props {
  track: SpotifyTrack;
  rank?: number;
  streams?: number;
}

export function TrackCard({ track, rank, streams }: Props) {
  const image = track.album.images?.[0]?.url;
  const artists = track.artists.map((a) => a.name).join(', ');

  return (
    <Link
      to={`/search?type=track&id=${track.id}`}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#1f1d33] transition-colors group"
    >
      {rank !== undefined && (
        <span className="text-sm font-bold text-violet-300 w-6 text-right shrink-0">
          {rank}
        </span>
      )}
      {image && (
        <img
          src={image}
          alt={track.name}
          className="w-12 h-12 rounded-lg object-cover shrink-0 shadow-sm"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-[#ede9f9] truncate group-hover:text-violet-300">
          {track.name}
        </p>
        <p className="text-xs text-[#6b6590] truncate">{artists}</p>
        {streams !== undefined ? (
          <p className="text-xs text-violet-400 font-semibold mt-0.5">{streams.toLocaleString()} streams</p>
        ) : (
          <div className="mt-1">
            <PopularityBar value={track.popularity} />
          </div>
        )}
      </div>
    </Link>
  );
}
