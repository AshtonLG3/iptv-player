import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRIVATE_PLAYLIST_MAX_BYTES,
  PRIVATE_PLAYLIST_STORAGE_KEY,
  clearPrivatePlaylist,
  getPrivatePlaylist,
  loadChannels,
  parsePrivatePlaylist,
  savePrivatePlaylist,
} from '../src/playlist.js';
import { APP_VERSION } from '../src/constants.js';

const SAMPLE = `#EXTM3U
#EXTINF:-1 tvg-id="NBC1.na@SD" tvg-logo="" group-title="General",NBC1
https://example.com/nbc1.m3u8
#EXTINF:-1 tvg-id="KBC.ke@SD" tvg-logo="" group-title="News",KBC
https://example.com/kbc.m3u8
#EXTINF:-1 tvg-id="2MMonde.ma@SD" tvg-logo="" group-title="General",2M Monde
https://example.com/2m.m3u8
`;
const DEFAULT_CACHE_KEY = `fta-iptv:playlist-cache:${APP_VERSION}:playlists/english-africa-uk-us-verified.m3u`;
const PRIVATE_SAMPLE = `#EXTM3U
#EXTINF:-1,Private Sports
http://example.com/account/token/100
#EXTINF:-1,Invalid entry
not-a-stream-url
#EXTINF:-1,Duplicate Sports
http://example.com/account/token/100
#EXTINF:-1,Private News
https://example.com/news.m3u8
`;

function createFakeStore() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
}

test('loadChannels fetches and parses the curated playlist on first call', async () => {
  let fetchCalls = 0;
  let requestedUrl = '';
  const fetchImpl = async (url) => {
    requestedUrl = url;
    fetchCalls += 1;
    return { ok: true, status: 200, text: async () => SAMPLE };
  };
  const sessionStore = createFakeStore();

  const channels = await loadChannels({ fetchImpl, sessionStore });

  assert.equal(fetchCalls, 1);
  assert.equal(requestedUrl, 'playlists/english-africa-uk-us-verified.m3u');
  assert.equal(channels.length, 3);
  assert.deepEqual(channels.map((channel) => channel.name), ['NBC1', 'KBC', '2M Monde']);
});

test('loadChannels can still filter to selected FTA countries', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => SAMPLE });
  const sessionStore = createFakeStore();

  const channels = await loadChannels({ fetchImpl, sessionStore, filterCountries: true });

  assert.equal(channels.length, 1);
  assert.equal(channels[0].name, 'KBC');
});

test('loadChannels reuses the cached result on a second call without re-fetching', async () => {
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    return { ok: true, status: 200, text: async () => SAMPLE };
  };
  const sessionStore = createFakeStore();

  await loadChannels({ fetchImpl, sessionStore });
  const second = await loadChannels({ fetchImpl, sessionStore });

  assert.equal(fetchCalls, 1);
  assert.equal(second.length, 3);
  assert.equal(second[0].name, 'NBC1');
});

test('loadChannels throws and does not cache when the fetch response is not ok', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, text: async () => '' });
  const sessionStore = createFakeStore();

  await assert.rejects(
    () => loadChannels({ fetchImpl, sessionStore }),
    /Failed to fetch playlist: 500/,
  );
  assert.equal(sessionStore.getItem(DEFAULT_CACHE_KEY), null);
});

test('loadChannels recovers from corrupted cache by fetching fresh', async () => {
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    return { ok: true, status: 200, text: async () => SAMPLE };
  };
  const sessionStore = createFakeStore();

  // seed cache with corrupted (non-JSON) data
  sessionStore.setItem(DEFAULT_CACHE_KEY, 'corrupted{][}invalid');

  const channels = await loadChannels({ fetchImpl, sessionStore });

  assert.equal(fetchCalls, 1);
  assert.equal(channels.length, 3);
  assert.equal(channels[1].name, 'KBC');
});

test('private playlist import keeps valid unique HTTP streams on the local device', () => {
  const localStore = createFakeStore();
  const result = savePrivatePlaylist(localStore, {
    name: 'C:\\Downloads\\Sport.m3u',
    text: PRIVATE_SAMPLE,
  });

  assert.deepEqual(result, { name: 'Sport.m3u', channelCount: 2 });
  assert.ok(localStore.getItem(PRIVATE_PLAYLIST_STORAGE_KEY));
  assert.deepEqual(
    getPrivatePlaylist(localStore).channels.map((channel) => channel.name),
    ['Private Sports', 'Private News'],
  );
});

test('loadChannels prefers an imported private playlist without fetching', async () => {
  const privateStore = createFakeStore();
  const sessionStore = createFakeStore();
  let fetchCalls = 0;
  savePrivatePlaylist(privateStore, { name: 'Sport.m3u', text: PRIVATE_SAMPLE });

  const channels = await loadChannels({
    fetchImpl: async () => {
      fetchCalls += 1;
      return { ok: true, status: 200, text: async () => SAMPLE };
    },
    sessionStore,
    privateStore,
  });

  assert.equal(fetchCalls, 0);
  assert.deepEqual(channels.map((channel) => channel.name), ['Private Sports', 'Private News']);
});

test('private playlist import can be cleared to restore curated loading', () => {
  const localStore = createFakeStore();
  savePrivatePlaylist(localStore, { name: 'Sport.m3u', text: PRIVATE_SAMPLE });

  clearPrivatePlaylist(localStore);

  assert.equal(getPrivatePlaylist(localStore), null);
});

test('private playlist import rejects invalid and oversized files', () => {
  assert.throws(
    () => parsePrivatePlaylist('#EXTM3U\n#EXTINF:-1,Broken\nnot-a-url\n'),
    /no playable HTTP or HTTPS M3U entries/,
  );
  assert.throws(
    () => parsePrivatePlaylist('x'.repeat(PRIVATE_PLAYLIST_MAX_BYTES + 1)),
    /larger than 2 MB/,
  );
});
