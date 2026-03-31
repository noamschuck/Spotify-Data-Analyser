import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { formatMs } from '../spotify/history';
import { useHistory } from '../context/HistoryContext';
import { useForgottenGems } from '../context/ForgottenGemsContext';
import { SavePlaylistButton } from '../components/SavePlaylistButton';

function NumInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
}) {
  const [raw, setRaw] = useState(value === null ? '' : String(value));

  function handle(s: string) {
    setRaw(s);
    if (s === '') { onChange(null); return; }
    const n = parseInt(s, 10);
    if (!isNaN(n) && n >= 0) onChange(n);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={raw}
      placeholder={placeholder ?? '∞'}
      onChange={(e) => handle(e.target.value)}
      className="w-24 bg-[#262340] text-violet-200 text-sm rounded-lg px-3 py-1.5 border border-[#3e3b5e] focus:outline-none focus:border-violet-500 placeholder-[#6b6590] text-center"
    />
  );
}

export function ForgottenGems() {
  const location = useLocation();
  const { stats } = useHistory();
  const {
    status, progress, progressPct, gems, error,
    minStreams, maxStreams, minPlaylists, maxPlaylists,
    setMinStreams, setMaxStreams, setMinPlaylists, setMaxPlaylists,
    startFind, reset,
  } = useForgottenGems();

  if (!stats) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">✦</div>
        <h1 className="text-2xl font-bold text-violet-200 mb-2">Forgotten Gems</h1>
        <p className="text-[#6b6590] text-sm">
          Import your Spotify Extended Streaming History on the{' '}
          <a href="/history" className="text-violet-400 hover:text-violet-300 underline">History page</a>{' '}
          to discover your forgotten gems.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-violet-200">Forgotten Gems</h1>
      </div>
      <p className="text-sm text-[#6b6590] mb-6">
        Find songs matching any stream count and playlist range.
        {status === 'loading' && (
          <span className="ml-2 text-violet-400">Running in background — feel free to navigate away.</span>
        )}
      </p>

      {(status === 'idle') && (
        <div className="bg-[#18162a] rounded-2xl p-6 border border-[#2e2b46] space-y-5">

          {/* Streams range */}
          <div>
            <p className="text-sm font-semibold text-violet-300 mb-3">Stream count</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p className="text-xs text-[#6b6590]">Minimum streams</p>
                <NumInput
                  value={minStreams}
                  onChange={(v) => setMinStreams(v ?? 1)}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-[#6b6590]">Maximum streams <span className="text-[#4a4670]">(blank = no limit)</span></p>
                <NumInput
                  value={maxStreams}
                  onChange={setMaxStreams}
                  placeholder="∞"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-[#2e2b46]" />

          {/* Playlist range */}
          <div>
            <p className="text-sm font-semibold text-violet-300 mb-3">Playlist count</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p className="text-xs text-[#6b6590]">Minimum playlists</p>
                <NumInput
                  value={minPlaylists}
                  onChange={(v) => setMinPlaylists(v ?? 0)}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-[#6b6590]">Maximum playlists <span className="text-[#4a4670]">(blank = no limit)</span></p>
                <NumInput
                  value={maxPlaylists}
                  onChange={setMaxPlaylists}
                  placeholder="∞"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-[#2e2b46]" />

          {/* Summary + action */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs text-[#6b6590]">
              Tracks with{' '}
              <span className="text-violet-400">
                {minStreams}{maxStreams !== null ? `–${maxStreams}` : '+'} streams
              </span>
              {' '}in{' '}
              <span className="text-violet-400">
                {minPlaylists}{maxPlaylists !== null ? `–${maxPlaylists}` : '+'} playlist{maxPlaylists !== 1 ? 's' : ''}
              </span>
              . Scans all your playlists — may take a minute.
            </p>
            <button
              onClick={() => void startFind()}
              className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Find Gems
            </button>
          </div>
        </div>
      )}

      {status === 'loading' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm text-violet-300">
            <div className="w-4 h-4 border-2 border-[#2e2b46] border-t-violet-500 rounded-full animate-spin shrink-0" />
            {progress}
          </div>
          <div className="h-1.5 bg-[#262340] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-400 to-blue-400 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-[#6b6590]">{progressPct}%</p>
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {gems && status === 'done' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-[#6b6590]">
              {gems.length === 0
                ? 'No tracks match these filters.'
                : `${gems.length} track${gems.length !== 1 ? 's' : ''} found`}
            </p>
            <div className="flex items-center gap-3">
              {gems.length > 0 && (
                <SavePlaylistButton
                  trackIds={gems.map((g) => g.trackId)}
                  playlistName="Forgotten Gems"
                />
              )}
              <button
                onClick={reset}
                className="text-xs text-[#6b6590] hover:text-violet-300 transition-colors cursor-pointer"
              >
                ← Change filters
              </button>
            </div>
          </div>

          {gems.length > 0 && (
            <div className="bg-[#18162a] rounded-2xl shadow-sm shadow-black border border-[#2e2b46] overflow-hidden">
              <div className="divide-y divide-[#2e2b46]">
                {gems.map((gem, i) => (
                  <div key={gem.trackId} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-sm font-bold text-violet-200 w-6 text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <Link to={`/search?type=track&id=${gem.trackId}`} state={{ from: location.pathname }} className="text-sm font-medium text-[#ede9f9] hover:text-violet-300 truncate block">{gem.trackName}</Link>
                      <Link to={`/search?q=${encodeURIComponent(gem.artistName)}`} state={{ from: location.pathname }} className="text-xs text-[#6b6590] hover:text-violet-400 truncate block">{gem.artistName}</Link>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          gem.playlistCount === 0
                            ? 'bg-red-900/40 text-red-400'
                            : 'bg-[#262340] text-[#8a85ad]'
                        }`}
                      >
                        {gem.playlistCount === 0 ? 'not saved' : `${gem.playlistCount} playlist${gem.playlistCount !== 1 ? 's' : ''}`}
                      </span>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-violet-400">{gem.streams}×</p>
                        <p className="text-xs text-[#6b6590]">{formatMs(gem.msPlayed)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
