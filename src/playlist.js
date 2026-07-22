import { APP_VERSION, CURATED_PLAYLISTS } from './constants.js';
import { parseM3U, filterByFtaCountries } from './parser.js';

const DEFAULT_PLAYLIST_URL = CURATED_PLAYLISTS[0].url;
const CACHE_KEY_PREFIX = 'fta-iptv:playlist-cache:';

export async function loadChannels({
  fetchImpl,
  sessionStore,
  playlistUrl = DEFAULT_PLAYLIST_URL,
  filterCountries = false,
}) {
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
