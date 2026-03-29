import { initiateLogin } from '../spotify/auth';

export function Login() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f1a] via-[#0d0b1f] to-[#0f0f1a] flex items-center justify-center">
      <div className="text-center max-w-md px-6">
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
        <p className="text-xs text-[#6b6590] mt-4">
          We only read your data — nothing is posted or changed.
        </p>
      </div>
    </div>
  );
}
