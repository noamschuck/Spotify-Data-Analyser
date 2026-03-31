import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { initiateLogin, CUSTOM_CLIENT_ID_KEY } from '../spotify/auth';

export function Login() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');
  const [showClientId, setShowClientId] = useState(false);
  const [clientIdInput, setClientIdInput] = useState(
    localStorage.getItem(CUSTOM_CLIENT_ID_KEY) ?? ''
  );
  const [saved, setSaved] = useState(false);

  const isUsingCustom = !!localStorage.getItem(CUSTOM_CLIENT_ID_KEY);

  function saveClientId() {
    const val = clientIdInput.trim();
    if (val) {
      localStorage.setItem(CUSTOM_CLIENT_ID_KEY, val);
    } else {
      localStorage.removeItem(CUSTOM_CLIENT_ID_KEY);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function clearClientId() {
    localStorage.removeItem(CUSTOM_CLIENT_ID_KEY);
    setClientIdInput('');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f1a] via-[#0d0b1f] to-[#0f0f1a] flex items-center justify-center">
      <div className="text-center max-w-md w-full px-6">
        <div className="w-20 h-20 bg-gradient-to-br from-violet-400 to-blue-400 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-violet-200">
          <span className="text-4xl">🎵</span>
        </div>
        <h1 className="text-4xl font-bold text-violet-200 mb-3 tracking-tight">
          Spotify Analyzer
        </h1>
        <p className="text-[#a09bc0] mb-8 leading-relaxed">
          Explore your Spotify listening stats — top tracks, favorite artists, playlist insights, and your music taste profile.
        </p>

        <button
          onClick={initiateLogin}
          className="bg-gradient-to-r from-violet-500 to-blue-500 text-white font-semibold px-8 py-3 rounded-xl shadow-md shadow-violet-200 hover:shadow-lg hover:shadow-violet-300 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
        >
          Connect with Spotify
        </button>

        {error && (
          <p className="text-xs text-red-400 mt-4 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
            Auth error: {error}
          </p>
        )}

        <p className="text-xs text-[#6b6590] mt-4">
          We only read your data — nothing is posted or changed.
        </p>

        {/* Custom Client ID section */}
        <div className="mt-8 text-left">
          <button
            onClick={() => setShowClientId(!showClientId)}
            className="text-xs text-[#6b6590] hover:text-violet-400 transition-colors cursor-pointer flex items-center gap-1 mx-auto"
          >
            <span>{showClientId ? '▾' : '▸'}</span>
            {isUsingCustom ? 'Using your own Spotify app' : 'Use your own Spotify app'}
          </button>

          {showClientId && (
            <div className="mt-3 bg-[#18162a] border border-[#2e2b46] rounded-xl p-4 space-y-4">
              <p className="text-xs text-[#a09bc0]">
                Spotify limits this app to 5 users. Set up your own free Spotify Developer app in ~2 minutes:
              </p>
              <ol className="space-y-2">
                {[
                  <>Go to <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline">developer.spotify.com/dashboard</a> and log in</>,
                  <>Click <span className="text-violet-300 font-medium">Create app</span></>,
                  <>Give it any name and description</>,
                  <>In <span className="text-violet-300 font-medium">Redirect URIs</span>, add: <span className="text-violet-300 font-mono text-[10px] break-all">{window.location.origin}/callback</span></>,
                  <>Under <span className="text-violet-300 font-medium">APIs used</span>, check <span className="text-violet-300 font-medium">Web API</span></>,
                  <>Click <span className="text-violet-300 font-medium">Save</span>, then open your new app and copy the <span className="text-violet-300 font-medium">Client ID</span></>,
                  <>Paste it below and click Save</>,
                ].map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-xs text-[#a09bc0]">
                    <span className="text-violet-500 font-bold shrink-0">{i + 1}.</span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={clientIdInput}
                  onChange={(e) => { setClientIdInput(e.target.value); setSaved(false); }}
                  placeholder="Paste your Client ID here"
                  className="flex-1 bg-[#262340] text-violet-200 text-xs rounded-lg px-3 py-2 border border-[#3e3b5e] focus:outline-none focus:border-violet-500 placeholder-[#6b6590]"
                />
                <button
                  onClick={saveClientId}
                  className="px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  {saved ? 'Saved!' : 'Save'}
                </button>
              </div>
              {isUsingCustom && (
                <button
                  onClick={clearClientId}
                  className="text-xs text-[#6b6590] hover:text-red-400 transition-colors cursor-pointer"
                >
                  ✕ Remove — revert to default app
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
