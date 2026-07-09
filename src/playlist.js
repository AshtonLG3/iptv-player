import { parseM3U, filterByFtaCountries } from './parser.js';

const PLAYLIST_URL = 'https://iptv-org.github.io/iptv/index.m3u';
const CACHE_KEY = 'fta-iptv:playlist-cache';

export async function loadChannels({ fetchImpl, sessionStore }) {
  const cached = sessionStore.getItem(CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // Corrupted cache entry; fall through and fetch fresh.
    }
  }

  const response = await fetchImpl(PLAYLIST_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch playlist: ${response.status}`);
  }

  const text = await response.text();
  const channels = filterByFtaCountries(parseM3U(text));
  sessionStore.setItem(CACHE_KEY, JSON.stringify(channels));
  return channels;
}
