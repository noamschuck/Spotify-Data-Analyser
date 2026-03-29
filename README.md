# Spotify Analyzer

Personal Spotify stats app — pure frontend, PKCE OAuth, no backend.

## Running

Double-click `launch.sh` or search "Spotify Analyzer" in your app launcher.
Or manually: `npm run dev` → open `http://localhost:5173`

## Features

- Top Tracks / Artists / Albums with Full Data mode (import your streaming history)
- Date range filtering (4W / 6M / 1Y / All / Custom) with range-accurate stream counts
- Taste Analysis — genre breakdown and music profile
- Search with personal stats (stream count, playlist membership)
- Forgotten Gems — tracks you love that aren't in any playlist
- Playlist creation from your top tracks

## Pending / Next Steps

### Needs testing (Spotify rate limit active — wait for it to clear)
- [ ] **Playlist save feature** — scopes are in place, UI is built (SavePlaylistButton), not yet confirmed working
- [ ] **Dashboard** — calls `getPlaylists()` on mount, avoid until rate limit clears
- [ ] **Forgotten Gems scan** — also calls `getPlaylists()`, avoid until rate limit clears

### Next features to build
- [ ] **People comparison** — compare your listening stats with a friend

### Notes
- Re-import your Spotify Extended Streaming History JSON to get range-accurate stream counts (monthly breakdown now stored per track)
- Spotify rate limit (`retry-after: 50614s ~14h`) affects all `getPlaylists()` calls — don't visit Playlists, Dashboard, or Forgotten Gems while it's active or the timer resets
