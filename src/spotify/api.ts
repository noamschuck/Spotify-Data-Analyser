import { getValidToken } from './auth';

const BASE = 'https://api.spotify.com/v1';

async function request<T>(path: string, params?: Record<string, string>): Promise<T> {
  const token = await getValidToken();
  if (!token) throw new Error('401: Not authenticated');

  const url = new URL(`${BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? 1);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return request<T>(path, params);
  }

  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface SpotifyImage {
  url: string;
  width: number | null;
  height: number | null;
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  images: SpotifyImage[];
  followers: { total: number };
  country: string;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  images: SpotifyImage[];
  genres: string[];
  popularity: number;
  followers: { total: number };
  external_urls: { spotify: string };
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  release_date: string;
  total_tracks: number;
  artists: Pick<SpotifyArtist, 'id' | 'name' | 'external_urls'>[];
  external_urls: { spotify: string };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  popularity: number;
  duration_ms: number;
  explicit: boolean;
  artists: Pick<SpotifyArtist, 'id' | 'name' | 'external_urls'>[];
  album: SpotifyAlbum;
  external_urls: { spotify: string };
}

export interface AudioFeatures {
  danceability: number;
  energy: number;
  valence: number;
  tempo: number;
  acousticness: number;
  instrumentalness: number;
  speechiness: number;
  loudness: number;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  images: SpotifyImage[];
  tracks: { total: number; href: string };
  owner: { display_name: string };
  public: boolean;
  external_urls: { spotify: string };
}

export type TimeRange = 'short_term' | 'medium_term' | 'long_term';

// ── API calls ──────────────────────────────────────────────────────────────

export async function getMe(): Promise<SpotifyUser> {
  return request<SpotifyUser>('/me');
}

export async function getTopTracks(timeRange: TimeRange, limit = 50): Promise<SpotifyTrack[]> {
  const data = await request<{ items: SpotifyTrack[] }>('/me/top/tracks', {
    time_range: timeRange,
    limit: String(limit),
  });
  return data.items;
}

export async function getTopArtists(timeRange: TimeRange, limit = 50): Promise<SpotifyArtist[]> {
  const data = await request<{ items: SpotifyArtist[] }>('/me/top/artists', {
    time_range: timeRange,
    limit: String(limit),
  });
  return data.items;
}

export async function getPlaylists(): Promise<SpotifyPlaylist[]> {
  const playlists: SpotifyPlaylist[] = [];
  let url: string | null = '/me/playlists?limit=50';

  while (url) {
    const path: string = url.startsWith('http') ? url.replace(BASE, '') : url;
    const data: { items: SpotifyPlaylist[]; next: string | null } = await request(path);
    playlists.push(...data.items);
    url = data.next;
  }

  return playlists;
}

export async function getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = [];
  let path: string | null = `/playlists/${playlistId}/tracks?limit=50&fields=items(track(id,name,duration_ms,explicit,popularity,artists,album,external_urls)),next`;

  while (path) {
    const data: { items: { track: SpotifyTrack | null }[]; next: string | null } = await request(path);
    tracks.push(...data.items.map((item) => item.track).filter((t): t is SpotifyTrack => !!t));
    path = data.next ? data.next.replace(BASE, '') : null;
  }

  return tracks;
}

export async function getPlaylistTrackIds(playlistId: string): Promise<string[]> {
  const ids: string[] = [];
  let path: string | null = `/playlists/${playlistId}/tracks?limit=100&fields=items(track(id)),next`;
  while (path) {
    const data: { items: { track: { id: string } | null }[]; next: string | null } = await request(path);
    ids.push(...data.items.map((i) => i.track?.id).filter((id): id is string => !!id));
    path = data.next ? data.next.replace(BASE, '') : null;
  }
  return ids;
}

export async function searchSpotify(
  q: string,
  types: ('track' | 'artist' | 'album')[]
): Promise<{
  tracks?: { items: SpotifyTrack[] };
  artists?: { items: SpotifyArtist[] };
  albums?: { items: SpotifyAlbum[] };
}> {
  return request('/search', { q, type: types.join(','), limit: '10' });
}

export async function getArtist(id: string): Promise<SpotifyArtist> {
  return request<SpotifyArtist>(`/artists/${id}`);
}

export async function getArtistsById(ids: string[]): Promise<SpotifyArtist[]> {
  const results: SpotifyArtist[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const data: { artists: (SpotifyArtist | null)[] } = await request('/artists', { ids: batch.join(',') });
    results.push(...data.artists.filter((a): a is SpotifyArtist => a !== null));
  }
  return results;
}

export async function searchArtistByName(name: string): Promise<SpotifyArtist | null> {
  try {
    const data = await request<{ artists: { items: SpotifyArtist[] } }>('/search', {
      q: name,
      type: 'artist',
      limit: '1',
    });
    return data.artists.items[0] ?? null;
  } catch {
    return null;
  }
}

export async function getArtistTopTracks(id: string): Promise<SpotifyTrack[]> {
  const data = await request<{ tracks: SpotifyTrack[] }>(`/artists/${id}/top-tracks`, {
    market: 'from_token',
  });
  return data.tracks;
}

export async function getTrack(id: string): Promise<SpotifyTrack> {
  return request<SpotifyTrack>(`/tracks/${id}`);
}

export async function getAudioFeatures(id: string): Promise<AudioFeatures | null> {
  try {
    return await request<AudioFeatures>(`/audio-features/${id}`);
  } catch {
    return null;
  }
}

export async function getAlbum(id: string): Promise<SpotifyAlbum & { tracks: { items: SpotifyTrack[] } }> {
  return request(`/albums/${id}`);
}

export async function getTracksById(ids: string[]): Promise<SpotifyTrack[]> {
  const results: SpotifyTrack[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const data: { tracks: (SpotifyTrack | null)[] } = await request('/tracks', { ids: batch.join(',') });
    results.push(...data.tracks.filter((t): t is SpotifyTrack => t !== null));
  }
  return results;
}

export async function checkFollowingArtists(ids: string[]): Promise<boolean[]> {
  const data = await request<boolean[]>('/me/following/contains', {
    type: 'artist',
    ids: ids.join(','),
  });
  return data;
}
