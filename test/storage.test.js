import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadFavorites,
  toggleFavorite,
  isFavorite,
  createFavoritesApi,
  getLastWatched,
  setLastWatched,
  getTheme,
  setTheme,
} from '../src/storage.js';

function createFakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

test('favorite sort and manual order persist across reopening without losing membership', () => {
  const storage = createFakeStorage();
  const api = createFavoritesApi(storage);
  for (const url of ['a', 'b', 'c']) api.toggle(url);
  api.setSort('saved');
  assert.equal(api.move('c', -1), true);
  assert.equal(api.move('a', -1), false);
  assert.equal(api.move('missing', 1), false);
  const reopened = createFavoritesApi(storage);
  assert.equal(reopened.getSort(), 'saved');
  assert.deepEqual(reopened.order(), ['a', 'c', 'b']);
  assert.equal(reopened.isFavorite('c'), true);
  reopened.setSort('za');
  assert.equal(createFavoritesApi(storage).getSort(), 'za');
});

test('loadFavorites returns an empty list when nothing is stored', () => {
  const storage = createFakeStorage();
  assert.deepEqual(loadFavorites(storage), []);
});

test('favorite membership checks reuse cached storage and synchronize toggles and external changes', () => {
  const storage = createFakeStorage();
  let reads = 0;
  const getItem = storage.getItem;
  storage.getItem = (key) => { reads += 1; return getItem(key); };
  const favorites = createFavoritesApi(storage);
  favorites.toggle('alpha');
  const readsAfterToggle = reads;
  for (let index = 0; index < 10000; index += 1) {
    assert.equal(favorites.isFavorite('alpha'), true);
    assert.equal(favorites.isFavorite('beta'), false);
  }
  assert.equal(reads, readsAfterToggle);
  toggleFavorite(storage, 'beta');
  favorites.reload();
  assert.equal(favorites.isFavorite('beta'), true);
  favorites.toggle('alpha');
  assert.equal(favorites.isFavorite('alpha'), false);
  assert.deepEqual(loadFavorites(storage), ['beta']);
});

test('toggleFavorite adds then removes a channel url', () => {
  const storage = createFakeStorage();
  const url = 'https://example.com/nbc1.m3u8';

  const afterAdd = toggleFavorite(storage, url);
  assert.deepEqual(afterAdd, [url]);
  assert.equal(isFavorite(storage, url), true);

  const afterRemove = toggleFavorite(storage, url);
  assert.deepEqual(afterRemove, []);
  assert.equal(isFavorite(storage, url), false);
});

test('getLastWatched is null until setLastWatched is called', () => {
  const storage = createFakeStorage();
  assert.equal(getLastWatched(storage), null);

  setLastWatched(storage, 'https://example.com/nbc1.m3u8');
  assert.equal(getLastWatched(storage), 'https://example.com/nbc1.m3u8');
});

test('theme storage defaults to dark and persists light mode', () => {
  const storage = createFakeStorage();

  assert.equal(getTheme(storage), 'dark');
  assert.equal(setTheme(storage, 'light'), 'light');
  assert.equal(getTheme(storage), 'light');
  assert.equal(setTheme(storage, 'unexpected'), 'dark');
  assert.equal(getTheme(storage), 'dark');
});
