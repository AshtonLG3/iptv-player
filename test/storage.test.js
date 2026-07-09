import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadFavorites,
  toggleFavorite,
  isFavorite,
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

test('loadFavorites returns an empty list when nothing is stored', () => {
  const storage = createFakeStorage();
  assert.deepEqual(loadFavorites(storage), []);
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
