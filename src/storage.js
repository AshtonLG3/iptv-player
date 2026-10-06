const FAVORITES_KEY = 'fta-iptv:favorites';
const LAST_WATCHED_KEY = 'fta-iptv:last-watched';
const THEME_KEY = 'fta-iptv:theme';

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

export function createFavoritesApi(storage) {
  let favorites = new Set(loadFavorites(storage));
  return {
    isFavorite: (url) => favorites.has(url),
    order: () => [...favorites],
    getSort: () => ['saved', 'za'].includes(storage.getItem('fta-iptv:favorite-sort'))
      ? storage.getItem('fta-iptv:favorite-sort') : 'az',
    setSort(value) {
      storage.setItem('fta-iptv:favorite-sort', ['saved', 'za'].includes(value) ? value : 'az');
    },
    move(url, direction) {
      const ordered = [...favorites];
      const index = ordered.indexOf(url);
      const next = index + Math.sign(direction);
      if (index < 0 || next < 0 || next >= ordered.length) return false;
      [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
      favorites = new Set(ordered);
      storage.setItem(FAVORITES_KEY, JSON.stringify(ordered));
      return true;
    },
    toggle(url) {
      const updated = toggleFavorite(storage, url);
      favorites = new Set(updated);
      return updated;
    },
    reload() {
      favorites = new Set(loadFavorites(storage));
    },
  };
}

export function getLastWatched(storage) {
  return storage.getItem(LAST_WATCHED_KEY) || null;
}

export function setLastWatched(storage, channelUrl) {
  storage.setItem(LAST_WATCHED_KEY, channelUrl);
}

export function getTheme(storage) {
  return storage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
}

export function setTheme(storage, theme) {
  const nextTheme = theme === 'light' ? 'light' : 'dark';
  storage.setItem(THEME_KEY, nextTheme);
  return nextTheme;
}
