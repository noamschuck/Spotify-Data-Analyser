import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { to: '/you', label: 'You', icon: '◉' },
  { to: '/top-tracks', label: 'Top Tracks', icon: '♪' },
  { to: '/top-artists', label: 'Top Artists', icon: '★' },
  { to: '/taste', label: 'Music Taste', icon: '◈' },
  { to: '/playlists', label: 'Playlists', icon: '≡' },
  { to: '/search', label: 'Search', icon: '⌕' },
  { to: '/history', label: 'History', icon: '◷' },
  { to: '/forgotten-gems', label: 'Forgotten Gems', icon: '✦' },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <aside className="fixed left-0 top-0 h-screen w-52 bg-[#0d0b1a] border-r border-[#2e2b46] flex flex-col z-50 shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#2e2b46]">
        <Link to="/dashboard" className="font-bold text-violet-500 text-lg tracking-tight">
          Spotistats
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_LINKS.map(({ to, label, icon }) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full ${
              pathname === to
                ? 'bg-[#262340] text-violet-300'
                : 'text-[#a09bc0] hover:text-violet-300 hover:bg-[#1f1d33]'
            }`}
          >
            <span className="text-base leading-none w-4 text-center">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="px-3 py-4 border-t border-[#2e2b46] space-y-3">
        <div className="flex items-center gap-2.5 px-2">
          {user?.images?.[0] && (
            <img
              src={user.images[0].url}
              alt={user.display_name}
              className="w-7 h-7 rounded-full ring-2 ring-[#3e3b5e] shrink-0"
            />
          )}
          <span className="text-xs text-[#a09bc0] truncate">{user?.display_name}</span>
        </div>
        <button
          onClick={logout}
          className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-violet-400 hover:text-violet-300 hover:bg-[#1f1d33] transition-colors cursor-pointer"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
