import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TimeRangeProvider } from './context/TimeRangeContext';
import { HistoryProvider } from './context/HistoryContext';
import { ForgottenGemsProvider } from './context/ForgottenGemsContext';
import { ArtistGenreProvider, useArtistGenre } from './context/ArtistGenreContext';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { Callback } from './pages/Callback';
import { Dashboard } from './pages/Dashboard';
import { TopTracks } from './pages/TopTracks';
import { TopArtists } from './pages/TopArtists';
import { TopAlbums } from './pages/TopAlbums';
import { TasteAnalysis } from './pages/TasteAnalysis';
import { Playlists } from './pages/Playlists';
import { Search } from './pages/Search';
import { History } from './pages/History';
import { ForgottenGems } from './pages/ForgottenGems';
import { You } from './pages/You';
import { LoadingSpinner } from './components/LoadingSpinner';

function GenreProgressBar() {
  const { status, progress, done, total } = useArtistGenre();
  if (status !== 'loading' || progress === 0) return null;

  return (
    <div className="fixed top-0 left-52 right-0 z-50 pointer-events-none">
      <div className="h-0.5 bg-[#1f1d33]">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      {total > 0 && (
        <div className="absolute right-3 top-1 text-[10px] text-violet-400 bg-[#0d0b1a]/90 px-2 py-0.5 rounded-full pointer-events-none">
          Genre data: {done}/{total} artists
        </div>
      )}
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/callback" element={<Callback />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <ArtistGenreProvider>
      <GenreProgressBar />
      <div className="flex min-h-screen">
        <Navbar />
        <main className="ml-52 flex-1 min-h-screen overflow-y-auto">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/top-tracks" element={<TopTracks />} />
            <Route path="/top-artists" element={<TopArtists />} />
            <Route path="/top-albums" element={<TopAlbums />} />
            <Route path="/taste" element={<TasteAnalysis />} />
            <Route path="/playlists" element={<Playlists />} />
            <Route path="/search" element={<Search />} />
            <Route path="/history" element={<History />} />
            <Route path="/you" element={<You />} />
            <Route path="/forgotten-gems" element={<ForgottenGems />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </ArtistGenreProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TimeRangeProvider>
          <HistoryProvider>
            <ForgottenGemsProvider>
              <AppRoutes />
            </ForgottenGemsProvider>
          </HistoryProvider>
        </TimeRangeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
