import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { createPlaylist, addTracksToPlaylist, getPlaylists, type SpotifyPlaylist } from '../spotify/api';

interface Props {
  trackIds: string[];
  playlistName: string;
}

function Modal({
  trackIds,
  defaultName,
  onClose,
}: {
  trackIds: string[];
  defaultName: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [mode, setMode] = useState<'create' | 'existing'>('create');
  const [name, setName] = useState(defaultName);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[] | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (mode === 'existing' && playlists === null) {
      setLoadingPlaylists(true);
      getPlaylists()
        .then((pls) => {
          // Only show playlists the user owns (can modify)
          const owned = pls.filter((pl) => pl.owner?.id === user?.id);
          setPlaylists(owned);
          if (owned.length > 0) setSelectedId(owned[0].id);
        })
        .catch(() => setPlaylists([]))
        .finally(() => setLoadingPlaylists(false));
    }
  }, [mode, playlists, user?.id]);

  async function save() {
    if (!user || saving) return;
    setError(null);

    if (mode === 'create' && !name.trim()) {
      setError('Enter a playlist name.');
      return;
    }
    if (mode === 'existing' && !selectedId) {
      setError('Select a playlist.');
      return;
    }

    setSaving(true);
    setStep('Checking auth token…');
    try {
      const uris = trackIds.map((id) => `spotify:track:${id}`);
      let playlistId: string;

      if (mode === 'create') {
        setStep(`Creating playlist (user: ${user.id})…`);
        const pl = await createPlaylist(user.id, name.trim());
        playlistId = pl.id;
        setStep(`Adding ${uris.length} tracks…`);
      } else {
        playlistId = selectedId;
        setStep(`Adding ${uris.length} tracks…`);
      }

      await addTracksToPlaylist(playlistId, uris);
      setStep('');
      setDone(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('403') || msg.includes('401')) {
        setError('Permission denied — log out and log back in to grant playlist access, then try again.');
      } else {
        setError(msg || 'Something went wrong.');
      }
    } finally {
      setSaving(false);
      setStep('');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[#18162a] border border-[#3e3b5e] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div className="text-center space-y-3 py-2">
            <p className="text-3xl">✓</p>
            <p className="text-violet-300 font-semibold text-lg">
              {mode === 'create' ? 'Playlist created!' : 'Tracks added!'}
            </p>
            <p className="text-xs text-[#6b6590]">{trackIds.length} tracks saved to Spotify.</p>
            <button
              onClick={onClose}
              className="text-xs text-violet-400 hover:text-violet-300 cursor-pointer mt-2"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-violet-200">
                Save {trackIds.length} track{trackIds.length !== 1 ? 's' : ''} to Spotify
              </h3>
              <button onClick={onClose} className="text-[#6b6590] hover:text-violet-300 text-lg leading-none cursor-pointer">✕</button>
            </div>

            {/* Mode toggle */}
            <div className="inline-flex rounded-xl bg-[#262340] p-1 gap-1 mb-5">
              <button
                onClick={() => setMode('create')}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  mode === 'create' ? 'bg-[#18162a] text-violet-300 shadow-sm shadow-black' : 'text-violet-400 hover:text-violet-300'
                }`}
              >
                Create new
              </button>
              <button
                onClick={() => setMode('existing')}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  mode === 'existing' ? 'bg-[#18162a] text-violet-300 shadow-sm shadow-black' : 'text-violet-400 hover:text-violet-300'
                }`}
              >
                Add to existing
              </button>
            </div>

            {mode === 'create' ? (
              <div className="mb-5">
                <label className="text-xs text-[#6b6590] block mb-1.5">Playlist name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void save(); }}
                  className="w-full bg-[#262340] text-violet-200 text-sm rounded-xl px-4 py-2.5 border border-[#3e3b5e] focus:outline-none focus:border-violet-500"
                  placeholder="My playlist"
                  autoFocus
                />
              </div>
            ) : (
              <div className="mb-5">
                <label className="text-xs text-[#6b6590] block mb-1.5">Select playlist</label>
                {loadingPlaylists ? (
                  <p className="text-xs text-[#6b6590] py-2">Loading your playlists…</p>
                ) : playlists && playlists.length > 0 ? (
                  <select
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="w-full bg-[#262340] text-violet-200 text-sm rounded-xl px-3 py-2.5 border border-[#3e3b5e] focus:outline-none focus:border-violet-500 cursor-pointer"
                    size={Math.min(playlists.length, 6)}
                  >
                    {playlists.map((pl) => (
                      <option key={pl.id} value={pl.id} className="bg-[#262340] py-1">
                        {pl.name} ({pl.tracks?.total ?? 0} tracks)
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-[#6b6590] py-2">No playlists found that you can edit.</p>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-900/30 border border-red-700/40 rounded-xl px-3 py-2.5 mb-4">
                <p className="text-red-400 text-xs leading-relaxed">{error}</p>
              </div>
            )}

            {step && (
              <p className="text-xs text-violet-400 mb-3 font-mono">{step}</p>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="text-xs text-[#6b6590] hover:text-violet-300 cursor-pointer px-2 py-1"
              >
                Cancel
              </button>
              <button
                onClick={() => void save()}
                disabled={saving || (mode === 'existing' && loadingPlaylists)}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-default text-white text-sm font-semibold px-6 py-2 rounded-xl transition-colors cursor-pointer"
              >
                {saving ? 'Saving…' : mode === 'create' ? 'Create playlist' : 'Add tracks'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function SavePlaylistButton({ trackIds, playlistName }: Props) {
  const [open, setOpen] = useState(false);

  if (trackIds.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs bg-[#262340] hover:bg-violet-900/40 text-violet-400 hover:text-violet-300 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
      >
        + Save as playlist
      </button>
      {open && (
        <Modal
          trackIds={trackIds}
          defaultName={playlistName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
