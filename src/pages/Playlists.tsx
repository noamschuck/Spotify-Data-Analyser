import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getPlaylists,
  getPlaylistTracks,
  type SpotifyPlaylist,
  type SpotifyTrack,
} from '../spotify/api';
import { useHistory } from '../context/HistoryContext';
import { formatMs } from '../spotify/history';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { TrackCard } from '../components/TrackCard';

function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

export function Playlists() {
  const { stats: historyData } = useHistory();
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Record<string, SpotifyTrack[]>>({});
  const [loadingTracks, setLoadingTracks] = useState<string | null>(null);
  const [sortByHistory, setSortByHistory] = useState(false);
  const fetched = useRef(false);

  // Build a quick lookup: trackId → stream count from history
  const historyTrackMap = useMemo(
    () => new Map((historyData?.topTracks ?? []).map((t) => [t.trackId, t])),
    [historyData]
  );

  // Compute playlist history score from known fetched tracks
  function playlistHistoryStreams(plId: string): number {
    const tracks = playlistTracks[plId] ?? [];
    return tracks.reduce((s, t) => s + (historyTrackMap.get(t.id)?.streams ?? 0), 0);
  }

  function playlistHistoryMs(plId: string): number {
    const tracks = playlistTracks[plId] ?? [];
    return tracks.reduce((s, t) => s + (historyTrackMap.get(t.id)?.msPlayed ?? 0), 0);
  }

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    getPlaylists()
      .then(setPlaylists)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  async function toggleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!playlistTracks[id]) {
      setLoadingTracks(id);
      try {
        const tracks = await getPlaylistTracks(id);
        setPlaylistTracks((prev) => ({ ...prev, [id]: tracks }));
      } finally {
        setLoadingTracks(null);
      }
    }
  }

  // Sort order
  const sortedPlaylists = useMemo(() => {
    if (!sortByHistory) return playlists;
    return [...playlists].sort(
      (a, b) => playlistHistoryStreams(b.id) - playlistHistoryStreams(a.id)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlists, sortByHistory, playlistTracks]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-violet-200">Playlists</h1>
        {historyData && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6b6590]">Sort by:</span>
            <div className="inline-flex rounded-xl bg-[#262340] p-1 gap-1">
              <button
                onClick={() => setSortByHistory(false)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  !sortByHistory ? 'bg-[#18162a] text-violet-300 shadow-sm shadow-black' : 'text-violet-400'
                }`}
              >
                Default
              </button>
              <button
                onClick={() => setSortByHistory(true)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  sortByHistory ? 'bg-[#18162a] text-violet-300 shadow-sm shadow-black' : 'text-violet-400'
                }`}
              >
                Most Listened
              </button>
            </div>
          </div>
        )}
      </div>

      {sortByHistory && Object.keys(playlistTracks).length < playlists.length && (
        <p className="text-xs text-[#6b6590] mb-4">
          Expand playlists to load their tracks — listening scores update as you go.
        </p>
      )}

      {loading && <LoadingSpinner message="Loading your playlists..." />}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && !error && (
        <div className="space-y-3">
          {sortedPlaylists.map((pl) => {
            const isOpen = expanded === pl.id;
            const tracks = playlistTracks[pl.id] ?? [];
            const totalDuration = tracks.reduce((s, t) => s + t.duration_ms, 0);
            const histStreams = playlistHistoryStreams(pl.id);
            const histMs = playlistHistoryMs(pl.id);

            return (
              <div
                key={pl.id}
                className="bg-[#18162a] rounded-2xl shadow-sm shadow-black border border-[#2e2b46] overflow-hidden"
              >
                <button
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-[#1f1d33] transition-colors cursor-pointer"
                  onClick={() => toggleExpand(pl.id)}
                >
                  {pl.images?.[0] ? (
                    <img src={pl.images[0].url} alt={pl.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-[#262340] flex items-center justify-center shrink-0">
                      <span className="text-2xl">🎵</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-violet-200 truncate">{pl.name}</p>
                    <p className="text-xs text-[#6b6590] mt-0.5">
                      {pl.tracks?.total ?? 0} tracks
                      {tracks.length > 0 && ` · ${formatDuration(totalDuration)}`}
                      {!pl.public && (
                        <span className="ml-2 text-violet-400 bg-[#262340] rounded px-1.5 py-0.5">private</span>
                      )}
                    </p>
                    {histStreams > 0 && (
                      <p className="text-xs text-violet-400 font-medium mt-0.5">
                        {histStreams.toLocaleString()}× streamed · {formatMs(histMs)} listened
                      </p>
                    )}
                  </div>
                  <span className={`text-violet-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                </button>

                {isOpen && (
                  <div className="border-t border-[#2e2b46]">
                    {loadingTracks === pl.id ? (
                      <div className="py-6"><LoadingSpinner message="Loading tracks..." /></div>
                    ) : (
                      <>
                        {/* History summary for this playlist */}
                        {historyData && tracks.length > 0 && histStreams > 0 && (
                          <div className="grid grid-cols-3 gap-3 p-4 bg-[#1f1d33]/50 border-b border-[#2e2b46]">
                            <div className="text-center">
                              <p className="text-lg font-bold text-violet-400">{histStreams.toLocaleString()}×</p>
                              <p className="text-xs text-[#8a85ad]">total streams</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-blue-400">{formatMs(histMs)}</p>
                              <p className="text-xs text-[#8a85ad]">time listened</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-indigo-400">
                                {tracks.filter((t) => historyTrackMap.has(t.id)).length}
                              </p>
                              <p className="text-xs text-[#8a85ad]">tracks played</p>
                            </div>
                          </div>
                        )}

                        <div className="divide-y divide-[#2e2b46]">
                          {tracks
                            .slice()
                            .sort((a, b) => {
                              // Sort by streams if history available
                              const aS = historyTrackMap.get(a.id)?.streams ?? -1;
                              const bS = historyTrackMap.get(b.id)?.streams ?? -1;
                              return bS - aS;
                            })
                            .map((track, i) => {
                              const hist = historyTrackMap.get(track.id);
                              return (
                                <div key={`${track.id}-${i}`} className="relative">
                                  <TrackCard track={track} rank={i + 1} />
                                  {hist && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-right pointer-events-none">
                                      <p className="text-xs font-semibold text-violet-400">{hist.streams}×</p>
                                      <p className="text-xs text-[#6b6590]">{formatMs(hist.msPlayed)}</p>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
