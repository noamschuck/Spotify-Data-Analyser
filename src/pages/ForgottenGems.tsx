import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMs } from '../spotify/history';
import { useHistory } from '../context/HistoryContext';
import { useForgottenGems } from '../context/ForgottenGemsContext';

export function ForgottenGems() {
  const { stats } = useHistory();
  const {
    status,
    progress,
    gems,
    error,
    minStreams,
    maxPlaylists,
    setMinStreams,
    setMaxPlaylists,
    startFind,
    reset,
  } = useForgottenGems();

  // Local string state so user can fully clear and retype the number
  const [minStreamsInput, setMinStreamsInput] = useState(String(minStreams));

  function handleMinStreamsChange(raw: string) {
    setMinStreamsInput(raw);
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1) setMinStreams(n);
  }

  if (!stats) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">✦</div>
        <h1 className="text-2xl font-bold text-violet-200 mb-2">Forgotten Gems</h1>
        <p className="text-[#6b6590] text-sm">
          Import your Spotify Extended Streaming History on the{' '}
          <a href="/history" className="text-violet-400 hover:text-violet-300 underline">
            History page
          </a>{' '}
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
        Songs you've listened to a lot but haven't saved to playlists.
        {status === 'loading' && (
          <span className="ml-2 text-violet-400">Running in background — feel free to navigate away.</span>
        )}
      </p>

      {status === 'idle' && !gems && (
        <div className="bg-[#18162a] rounded-2xl p-6 border border-[#2e2b46] space-y-4">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-violet-300 mb-2">Minimum stream count</p>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  value={minStreamsInput}
                  onChange={(e) => handleMinStreamsChange(e.target.value)}
                  className="w-24 bg-[#262340] text-violet-200 text-sm rounded-lg px-3 py-1.5 border border-[#3e3b5e] focus:outline-none focus:border-violet-500"
                />
                <span className="text-xs text-[#6b6590]">streams or more to count as "a lot"</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-violet-300 mb-2">Show tracks in:</p>
              <div className="inline-flex rounded-xl bg-[#262340] p-1 gap-1">
                <button
                  onClick={() => setMaxPlaylists(0)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    maxPlaylists === 0 ? 'bg-[#18162a] text-violet-300 shadow-sm shadow-black' : 'text-violet-400'
                  }`}
                >
                  0 playlists (not saved anywhere)
                </button>
                <button
                  onClick={() => setMaxPlaylists(1)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    maxPlaylists === 1 ? 'bg-[#18162a] text-violet-300 shadow-sm shadow-black' : 'text-violet-400'
                  }`}
                >
                  0–1 playlists
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-[#6b6590]">
            This scans all your playlists — may take a minute. You can navigate away and come back.
          </p>
          <button
            onClick={() => void startFind()}
            className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors cursor-pointer"
          >
            Find My Forgotten Gems
          </button>
        </div>
      )}

      {status === 'loading' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm text-violet-300">
            <div className="w-4 h-4 border-2 border-[#2e2b46] border-t-violet-500 rounded-full animate-spin shrink-0" />
            {progress}
          </div>
          <div className="h-1.5 bg-[#262340] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-400 to-blue-400 rounded-full animate-pulse w-full" />
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {gems && status === 'done' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-[#6b6590]">
              {gems.length === 0
                ? 'All your most-played tracks are already saved to playlists!'
                : `${gems.length} gem${gems.length !== 1 ? 's' : ''} found`}
            </p>
            <button
              onClick={reset}
              className="text-xs text-[#6b6590] hover:text-violet-300 transition-colors cursor-pointer"
            >
              ← Change filter
            </button>
          </div>

          {gems.length > 0 && (
            <div className="bg-[#18162a] rounded-2xl shadow-sm shadow-black border border-[#2e2b46] overflow-hidden">
              <div className="divide-y divide-[#2e2b46]">
                {gems.map((gem, i) => (
                  <div key={gem.trackId} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-sm font-bold text-violet-200 w-6 text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <Link to={`/search?type=track&id=${gem.trackId}`} className="text-sm font-medium text-[#ede9f9] hover:text-violet-300 truncate block">{gem.trackName}</Link>
                      <Link to={`/search?q=${encodeURIComponent(gem.artistName)}`} className="text-xs text-[#6b6590] hover:text-violet-400 truncate block">{gem.artistName}</Link>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          gem.playlistCount === 0
                            ? 'bg-red-900/40 text-red-400'
                            : 'bg-[#262340] text-[#8a85ad]'
                        }`}
                      >
                        {gem.playlistCount === 0 ? 'not saved' : `${gem.playlistCount} playlist`}
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
