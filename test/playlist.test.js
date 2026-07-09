import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadChannels } from '../src/playlist.js';

const SAMPLE = `#EXTM3U
#EXTINF:-1 tvg-id="NBC1.na@SD" tvg-logo="" group-title="General",NBC1
https://example.com/nbc1.m3u8
#EXTINF:-1 tvg-id="KBC.ke@SD" tvg-logo="" group-title="News",KBC
https://example.com/kbc.m3u8
#EXTINF:-1 tvg-id="2MMonde.ma@SD" tvg-logo="" group-title="General",2M Monde
https://example.com/2m.m3u8
`;

function createFakeStore() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
}

test('loadChannels fetches, parses, and filters to selected FTA country channels on first call', async () => {
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    return { ok: true, status: 200, text: async () => SAMPLE };
  };
  const sessionStore = createFakeStore();

  const channels = await loadChannels({ fetchImpl, sessionStore });

  assert.equal(fetchCalls, 1);
  assert.equal(channels.length, 1);
  assert.equal(channels[0].name, 'KBC');
  assert.equal(channels[0].country, 'ke');
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
  assert.equal(second.length, 1);
  assert.equal(second[0].name, 'KBC');
});

test('loadChannels throws and does not cache when the fetch response is not ok', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, text: async () => '' });
  const sessionStore = createFakeStore();

  await assert.rejects(
    () => loadChannels({ fetchImpl, sessionStore }),
    /Failed to fetch playlist: 500/,
  );
  assert.equal(sessionStore.getItem('fta-iptv:playlist-cache'), null);
});

test('loadChannels recovers from corrupted cache by fetching fresh', async () => {
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    return { ok: true, status: 200, text: async () => SAMPLE };
  };
  const sessionStore = createFakeStore();

  // seed cache with corrupted (non-JSON) data
  sessionStore.setItem('fta-iptv:playlist-cache', 'corrupted{][}invalid');

  const channels = await loadChannels({ fetchImpl, sessionStore });

  assert.equal(fetchCalls, 1);
  assert.equal(channels.length, 1);
  assert.equal(channels[0].name, 'KBC');
  assert.equal(channels[0].country, 'ke');
});
