import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { to: '/dashboard',     label: 'Dashboard',     icon: '⊞' },
  { to: '/you',           label: 'You',            icon: '◉' },
  { to: '/forgotten-gems',label: 'Forgotten Gems', icon: '✦' },
  { to: '/history',       label: 'History',        icon: '◷' },
  { to: '/top-tracks',    label: 'Top Tracks',     icon: '♪' },
  { to: '/top-artists',   label: 'Top Artists',    icon: '★' },
  { to: '/top-albums',    label: 'Top Albums',     icon: '💿' },
  { to: '/playlists',     label: 'Playlists',      icon: '≡' },
  { to: '/search',        label: 'Search',         icon: '⌕' },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#2e2b46] flex items-center justify-between">
        <Link to="/dashboard" onClick={() => setOpen(false)} className="font-bold text-violet-500 text-lg tracking-tight">
          Spotify Analyzer
        </Link>
        <button onClick={() => setOpen(false)} className="md:hidden text-[#a09bc0] hover:text-violet-300 text-xl leading-none cursor-pointer">✕</button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_LINKS.map(({ to, label, icon }) => (
          <Link
            key={to}
            to={to}
            onClick={() => setOpen(false)}
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
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-52 bg-[#0d0b1a] border-r border-[#2e2b46] flex-col z-50 shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-12 bg-[#0d0b1a] border-b border-[#2e2b46] flex items-center px-4 z-50">
        <button onClick={() => setOpen(true)} className="text-violet-400 hover:text-violet-300 cursor-pointer text-xl leading-none mr-3">☰</button>
        <Link to="/dashboard" className="font-bold text-violet-500 text-base tracking-tight">Spotify Analyzer</Link>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <aside className="w-64 bg-[#0d0b1a] border-r border-[#2e2b46] flex flex-col h-full">
            {sidebarContent}
          </aside>
          <div className="flex-1 bg-black/50" onClick={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
