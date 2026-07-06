const FAVORITES_KEY = 'sadc-iptv:favorites';
const LAST_WATCHED_KEY = 'sadc-iptv:last-watched';

export function loadFavorites(storage) {
  const raw = storage.getItem(FAVORITES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(storage, channelUrl) {
  const current = loadFavorites(storage);
  const index = current.indexOf(channelUrl);
  const updated = index === -1
    ? [...current, channelUrl]
    : current.filter((url) => url !== channelUrl);

  storage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  return updated;
}

export function isFavorite(storage, channelUrl) {
  return loadFavorites(storage).includes(channelUrl);
}

export function getLastWatched(storage) {
  return storage.getItem(LAST_WATCHED_KEY) || null;
}

export function setLastWatched(storage, channelUrl) {
  storage.setItem(LAST_WATCHED_KEY, channelUrl);
}
