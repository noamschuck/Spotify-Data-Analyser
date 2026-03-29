import { Link } from 'react-router-dom';
import type { SpotifyArtist } from '../spotify/api';
import { PopularityBar } from './PopularityBar';

interface Props {
  artist: SpotifyArtist;
  rank?: number;
  streams?: number;
}

export function ArtistCard({ artist, rank, streams }: Props) {
  const image = artist.images?.[0]?.url;

  return (
    <Link
      to={`/search?type=artist&id=${artist.id}`}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#1f1d33] transition-colors group"
    >
      {rank !== undefined && (
        <span className="text-sm font-bold text-violet-300 w-6 text-right shrink-0">
          {rank}
        </span>
      )}
      {image ? (
        <img
          src={image}
          alt={artist.name}
          className="w-12 h-12 rounded-full object-cover shrink-0 shadow-sm"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
          <span className="text-violet-400 text-xl">🎵</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-[#ede9f9] truncate group-hover:text-violet-300">
          {artist.name}
        </p>
        <p className="text-xs text-[#6b6590] truncate">
          {artist.genres.slice(0, 3).join(', ') || 'No genres listed'}
        </p>
        {streams !== undefined ? (
          <p className="text-xs text-violet-400 font-semibold mt-0.5">{streams.toLocaleString()} streams</p>
        ) : (
          <div className="mt-1">
            <PopularityBar value={artist.popularity} />
          </div>
        )}
      </div>
    </Link>
  );
}
