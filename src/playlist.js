import { APP_VERSION, CURATED_PLAYLISTS } from './constants.js?v=20260808d';
import { parseM3U, filterByFtaCountries } from './parser.js?v=20260808d';

const DEFAULT_PLAYLIST_URL = CURATED_PLAYLISTS[0].url;
const CACHE_KEY_PREFIX = 'fta-iptv:playlist-cache:';
export const PRIVATE_PLAYLIST_STORAGE_KEY = 'fta-iptv:private-playlist:v1';
export const PRIVATE_PLAYLIST_MAX_BYTES = 2 * 1024 * 1024;

function getUtf8Size(text) {
  return new TextEncoder().encode(text).byteLength;
}

function normalizePrivatePlaylistName(name) {
  const filename = String(name || 'Private playlist')
    .split(/[\\/]/)
    .pop()
    .trim();
  return filename || 'Private playlist';
}

export function parsePrivatePlaylist(text) {
  const playlistText = String(text || '');
  if (!playlistText.trim()) {
    throw new Error('The selected playlist is empty.');
  }
  if (getUtf8Size(playlistText) > PRIVATE_PLAYLIST_MAX_BYTES) {
    throw new Error('The selected playlist is larger than 2 MB.');
  }

  const seenUrls = new Set();
  const channels = parseM3U(playlistText).filter((channel) => {
    if (!channel.name || !/^https?:\/\//i.test(channel.url)) return false;
    if (seenUrls.has(channel.url)) return false;
    seenUrls.add(channel.url);
    return true;
  });

  if (!channels.length) {
    throw new Error('The selected file has no playable HTTP or HTTPS M3U entries.');
  }
  return channels;
}

export function getPrivatePlaylist(storage) {
  if (!storage) return null;
  const stored = storage.getItem(PRIVATE_PLAYLIST_STORAGE_KEY);
  if (!stored) return null;

  try {
    const record = JSON.parse(stored);
    if (record?.schemaVersion !== 1 || typeof record.text !== 'string') return null;
    const channels = parsePrivatePlaylist(record.text);
    return {
      name: normalizePrivatePlaylistName(record.name),
      channels,
    };
  } catch {
    return null;
  }
}

export function savePrivatePlaylist(storage, { name, text }) {
  if (!storage) throw new Error('Private playlist storage is unavailable.');
  const channels = parsePrivatePlaylist(text);
  const normalizedName = normalizePrivatePlaylistName(name);
  storage.setItem(PRIVATE_PLAYLIST_STORAGE_KEY, JSON.stringify({
    schemaVersion: 1,
    name: normalizedName,
    text: String(text),
  }));
  return { name: normalizedName, channelCount: channels.length };
}

export function clearPrivatePlaylist(storage) {
  storage?.removeItem(PRIVATE_PLAYLIST_STORAGE_KEY);
}

export async function loadChannels({
  fetchImpl,
  sessionStore,
  privateStore = null,
  playlistUrl = DEFAULT_PLAYLIST_URL,
  filterCountries = false,
}) {
  const privatePlaylist = getPrivatePlaylist(privateStore);
  if (privatePlaylist) return privatePlaylist.channels;

  const cacheKey = `${CACHE_KEY_PREFIX}${APP_VERSION}:${playlistUrl}`;
  const cached = sessionStore.getItem(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // Corrupted cache entry; fall through and fetch fresh.
    }
  }

  const response = await fetchImpl(playlistUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch playlist: ${response.status}`);
  }

  const text = await response.text();
  const parsedChannels = parseM3U(text);
  const channels = filterCountries ? filterByFtaCountries(parsedChannels) : parsedChannels;
  sessionStore.setItem(cacheKey, JSON.stringify(channels));
  return channels;
}
