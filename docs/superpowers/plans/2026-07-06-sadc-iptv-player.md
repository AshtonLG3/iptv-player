# SADC IPTV Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, no-build-step web app that fetches the iptv-org playlist, filters it to SADC-country channels, and plays them in-browser via hls.js, with search/filter, favorites, and last-watched persistence.

**Architecture:** Pure ES modules under `src/`, each with one responsibility (parsing, storage, playlist loading, playback, UI rendering), wired together by a single `app.js` entry point loaded from `index.html`. No bundler, no framework, no backend — everything runs as static files served by any static file server.

**Tech Stack:** Vanilla JavaScript (ES modules), HTML5 `<video>`, [hls.js](https://github.com/video-dev/hls.js) via CDN `<script>` tag, Node's built-in test runner (`node --test`, Node 18+) for unit tests — zero npm dependencies.

## Global Constraints

- Playlist source: `https://iptv-org.github.io/iptv/index.m3u` (fetched client-side; GitHub Pages sends permissive CORS headers).
- Country scope: exactly these 16 SADC codes (lowercase ISO 3166-1 alpha-2, as they appear as the suffix on `tvg-id` in the playlist, e.g. `NBC1.na@SD`): `ao` (Angola), `bw` (Botswana), `km` (Comoros), `cd` (DR Congo), `sz` (Eswatini), `ls` (Lesotho), `mg` (Madagascar), `mw` (Malawi), `mu` (Mauritius), `mz` (Mozambique), `na` (Namibia), `sc` (Seychelles), `za` (South Africa), `tz` (Tanzania), `zm` (Zambia), `zw` (Zimbabwe).
- No backend, no build step, no bundler, no npm dependencies (Node is only used to run unit tests locally, not shipped).
- Persistence only via `localStorage` (favorites, last-watched channel) and `sessionStorage` (playlist cache) — no server-side storage, no accounts.
- Playback errors are handled per-channel, best-effort: no proxy, no cross-channel retry logic.
- Node version required for running tests: 18+ (for built-in `node --test`).

---

### Task 1: Project scaffold + M3U parser

**Files:**
- Create: `package.json`
- Create: `src/constants.js`
- Create: `src/parser.js`
- Test: `test/parser.test.js`

**Interfaces:**
- Produces: `SADC_COUNTRIES` (object, `{ [lowercase-iso-code]: displayName }`) from `src/constants.js`.
- Produces: `parseM3U(text: string): Channel[]` where `Channel = { name: string, tvgId: string, logo: string, category: string, country: string|null, url: string }`, from `src/parser.js`.
- Produces: `extractCountryCode(tvgId: string): string|null` from `src/parser.js`.
- Produces: `filterBySadc(channels: Channel[]): Channel[]` from `src/parser.js`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "sadc-iptv-player",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test test/"
  }
}
```

- [ ] **Step 2: Create `src/constants.js`**

```javascript
export const SADC_COUNTRIES = {
  ao: 'Angola',
  bw: 'Botswana',
  km: 'Comoros',
  cd: 'DR Congo',
  sz: 'Eswatini',
  ls: 'Lesotho',
  mg: 'Madagascar',
  mw: 'Malawi',
  mu: 'Mauritius',
  mz: 'Mozambique',
  na: 'Namibia',
  sc: 'Seychelles',
  za: 'South Africa',
  tz: 'Tanzania',
  zm: 'Zambia',
  zw: 'Zimbabwe',
};
```

- [ ] **Step 3: Write the failing test for the parser**

Create `test/parser.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseM3U, extractCountryCode, filterBySadc } from '../src/parser.js';

const SAMPLE = `#EXTM3U
#EXTINF:-1 tvg-id="NBC1.na@SD" tvg-logo="https://example.com/nbc.png" group-title="General",NBC1 (720p)
https://example.com/nbc1.m3u8
#EXTINF:-1 tvg-id="2MMonde.ma@SD" tvg-logo="https://example.com/2m.png" http-referrer="http://x" group-title="General",2M Monde (360p)
#EXTVLCOPT:http-referrer=http://x
https://example.com/2m.m3u8
#EXTINF:-1 tvg-id="" tvg-logo="" group-title="Movies",Unknown Channel
https://example.com/unknown.m3u8
#EXTINF:-1 tvg-id="CapeTownTV.za@SD" tvg-logo="" group-title="Entertainment;Family",Cape Town TV
https://example.com/capetown.m3u8
`;

test('extractCountryCode reads the country suffix from tvg-id', () => {
  assert.equal(extractCountryCode('NBC1.na@SD'), 'na');
  assert.equal(extractCountryCode('2MMonde.ma@SD'), 'ma');
  assert.equal(extractCountryCode('ch4teen.kw'), 'kw');
  assert.equal(extractCountryCode(''), null);
  assert.equal(extractCountryCode(undefined), null);
});

test('parseM3U extracts all channels, skipping #EXTVLCOPT lines', () => {
  const channels = parseM3U(SAMPLE);

  assert.equal(channels.length, 4);
  assert.deepEqual(channels[0], {
    name: 'NBC1 (720p)',
    tvgId: 'NBC1.na@SD',
    logo: 'https://example.com/nbc.png',
    category: 'General',
    country: 'na',
    url: 'https://example.com/nbc1.m3u8',
  });
  assert.equal(channels[1].url, 'https://example.com/2m.m3u8');
  assert.equal(channels[1].country, 'ma');
  assert.equal(channels[2].country, null);
  assert.equal(channels[3].category, 'Entertainment;Family');
});

test('filterBySadc keeps only SADC-country channels', () => {
  const channels = parseM3U(SAMPLE);
  const filtered = filterBySadc(channels);

  assert.equal(filtered.length, 2);
  assert.deepEqual(
    filtered.map((c) => c.name),
    ['NBC1 (720p)', 'Cape Town TV'],
  );
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `node --test test/parser.test.js`
Expected: FAIL — `Cannot find module '../src/parser.js'` (file doesn't exist yet).

- [ ] **Step 5: Implement `src/parser.js`**

```javascript
import { SADC_COUNTRIES } from './constants.js';

export function extractCountryCode(tvgId) {
  if (!tvgId) return null;
  const withoutQuality = tvgId.split('@')[0];
  const parts = withoutQuality.split('.');
  const candidate = parts[parts.length - 1].toLowerCase();
  return /^[a-z]{2}$/.test(candidate) ? candidate : null;
}

function parseExtinfLine(line) {
  const attrs = {};
  const attrRegex = /([a-zA-Z0-9-]+)="([^"]*)"/g;
  let match;
  while ((match = attrRegex.exec(line)) !== null) {
    attrs[match[1]] = match[2];
  }
  const nameMatch = line.match(/,([^,]*)$/);
  const name = nameMatch ? nameMatch[1].trim() : '';
  return { attrs, name };
}

export function parseM3U(text) {
  const lines = text.split('\n').map((line) => line.trim());
  const channels = [];
  let pending = null;

  for (const line of lines) {
    if (line.startsWith('#EXTINF:')) {
      const { attrs, name } = parseExtinfLine(line);
      pending = {
        name,
        tvgId: attrs['tvg-id'] || '',
        logo: attrs['tvg-logo'] || '',
        category: attrs['group-title'] || '',
        country: extractCountryCode(attrs['tvg-id'] || ''),
        url: '',
      };
    } else if (line === '' || line.startsWith('#')) {
      continue;
    } else if (pending) {
      pending.url = line;
      channels.push(pending);
      pending = null;
    }
  }

  return channels;
}

export function filterBySadc(channels) {
  return channels.filter((channel) => channel.country && SADC_COUNTRIES[channel.country]);
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --test test/parser.test.js`
Expected: PASS — 3 tests, 0 failures.

- [ ] **Step 7: Commit**

```bash
git add package.json src/constants.js src/parser.js test/parser.test.js
git commit -m "Add M3U parser with SADC country filtering"
```

---

### Task 2: Favorites & last-watched storage helpers

**Files:**
- Create: `src/storage.js`
- Test: `test/storage.test.js`

**Interfaces:**
- Consumes: nothing from other tasks (only a Web Storage-like object: `{ getItem(key), setItem(key, value), removeItem(key) }`, e.g. `window.localStorage`).
- Produces: `loadFavorites(storage): string[]`, `toggleFavorite(storage, channelUrl): string[]`, `isFavorite(storage, channelUrl): boolean`, `getLastWatched(storage): string|null`, `setLastWatched(storage, channelUrl): void` from `src/storage.js`.
- Note: `channelUrl` (the `Channel.url` field from Task 1) is used as the unique channel identifier throughout the app — there is no separate `id` field.

- [ ] **Step 1: Write the failing test**

Create `test/storage.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadFavorites,
  toggleFavorite,
  isFavorite,
  getLastWatched,
  setLastWatched,
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/storage.test.js`
Expected: FAIL — `Cannot find module '../src/storage.js'`.

- [ ] **Step 3: Implement `src/storage.js`**

```javascript
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/storage.test.js`
Expected: PASS — 3 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/storage.js test/storage.test.js
git commit -m "Add favorites and last-watched storage helpers"
```

---

### Task 3: Playlist loader with session caching

**Files:**
- Create: `src/playlist.js`
- Test: `test/playlist.test.js`

**Interfaces:**
- Consumes: `parseM3U`, `filterBySadc` from `src/parser.js` (Task 1).
- Produces: `loadChannels({ fetchImpl, sessionStore }): Promise<Channel[]>` from `src/playlist.js`, where `fetchImpl` matches the `window.fetch` contract (`fetchImpl(url): Promise<{ ok, status, text(): Promise<string> }>`) and `sessionStore` matches the Web Storage contract used in Task 2.

- [ ] **Step 1: Write the failing test**

Create `test/playlist.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadChannels } from '../src/playlist.js';

const SAMPLE = `#EXTM3U
#EXTINF:-1 tvg-id="NBC1.na@SD" tvg-logo="" group-title="General",NBC1
https://example.com/nbc1.m3u8
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

test('loadChannels fetches, parses, and filters to SADC channels on first call', async () => {
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    return { ok: true, status: 200, text: async () => SAMPLE };
  };
  const sessionStore = createFakeStore();

  const channels = await loadChannels({ fetchImpl, sessionStore });

  assert.equal(fetchCalls, 1);
  assert.equal(channels.length, 1);
  assert.equal(channels[0].name, 'NBC1');
  assert.equal(channels[0].country, 'na');
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
  assert.equal(second[0].name, 'NBC1');
});

test('loadChannels throws and does not cache when the fetch response is not ok', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, text: async () => '' });
  const sessionStore = createFakeStore();

  await assert.rejects(
    () => loadChannels({ fetchImpl, sessionStore }),
    /Failed to fetch playlist: 500/,
  );
  assert.equal(sessionStore.getItem('sadc-iptv:playlist-cache'), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/playlist.test.js`
Expected: FAIL — `Cannot find module '../src/playlist.js'`.

- [ ] **Step 3: Implement `src/playlist.js`**

```javascript
import { parseM3U, filterBySadc } from './parser.js';

const PLAYLIST_URL = 'https://iptv-org.github.io/iptv/index.m3u';
const CACHE_KEY = 'sadc-iptv:playlist-cache';

export async function loadChannels({ fetchImpl, sessionStore }) {
  const cached = sessionStore.getItem(CACHE_KEY);
  if (cached) {
    return JSON.parse(cached);
  }

  const response = await fetchImpl(PLAYLIST_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch playlist: ${response.status}`);
  }

  const text = await response.text();
  const channels = filterBySadc(parseM3U(text));
  sessionStore.setItem(CACHE_KEY, JSON.stringify(channels));
  return channels;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/playlist.test.js`
Expected: PASS — 3 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/playlist.js test/playlist.test.js
git commit -m "Add playlist loader with session-cached fetch"
```

---

### Task 4: HLS player wrapper

**Files:**
- Create: `src/player.js`
- Test: `test/player.test.js`

**Interfaces:**
- Consumes: a video element-like object (`{ src, removeAttribute, canPlayType, play, addEventListener }`) and an optional `HlsCtor` (matching the `Hls.js` class shape: `static isSupported()`, `static Events.{ERROR,MANIFEST_PARSED}`, instance `on/loadSource/attachMedia/destroy`).
- Produces: `createPlayer(videoEl, { HlsCtor }?): { play(url: string): void, onError(handler: (err: Error) => void): void, destroy(): void }` from `src/player.js`.

- [ ] **Step 1: Write the failing test**

Create `test/player.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer } from '../src/player.js';

class FakeHls {
  static supported = true;
  static Events = { ERROR: 'error', MANIFEST_PARSED: 'manifest_parsed' };
  static instances = [];

  static isSupported() {
    return FakeHls.supported;
  }

  constructor() {
    this.handlers = {};
    this.loadSourceCalls = [];
    this.attachMediaCalls = [];
    this.destroyed = false;
    FakeHls.instances.push(this);
  }

  on(event, cb) {
    this.handlers[event] = cb;
  }

  loadSource(url) {
    this.loadSourceCalls.push(url);
  }

  attachMedia(el) {
    this.attachMediaCalls.push(el);
  }

  destroy() {
    this.destroyed = true;
  }

  trigger(event, data) {
    this.handlers[event]?.(null, data);
  }
}

function createFakeVideo({ canPlayHls = false, playResolves = true } = {}) {
  return {
    src: '',
    removeAttribute() {},
    canPlayType: (type) => (canPlayHls && type === 'application/vnd.apple.mpegurl' ? 'maybe' : ''),
    play() {
      return playResolves ? Promise.resolve() : Promise.reject(new Error('play failed'));
    },
    addEventListener() {},
  };
}

test('play() loads the source into Hls.js and attaches it to the video element', () => {
  FakeHls.supported = true;
  FakeHls.instances = [];
  const video = createFakeVideo();
  const player = createPlayer(video, { HlsCtor: FakeHls });

  player.play('https://example.com/stream.m3u8');

  const instance = FakeHls.instances[0];
  assert.equal(instance.loadSourceCalls[0], 'https://example.com/stream.m3u8');
  assert.equal(instance.attachMediaCalls[0], video);
});

test('play() reports fatal Hls.js errors via onError', () => {
  FakeHls.supported = true;
  FakeHls.instances = [];
  const video = createFakeVideo();
  const player = createPlayer(video, { HlsCtor: FakeHls });

  let receivedError = null;
  player.onError((err) => { receivedError = err; });
  player.play('https://example.com/stream.m3u8');

  FakeHls.instances[0].trigger('error', { fatal: true, details: 'networkError' });

  assert.ok(receivedError);
  assert.equal(receivedError.message, 'networkError');
});

test('play() ignores non-fatal Hls.js errors', () => {
  FakeHls.supported = true;
  FakeHls.instances = [];
  const video = createFakeVideo();
  const player = createPlayer(video, { HlsCtor: FakeHls });

  let receivedError = null;
  player.onError((err) => { receivedError = err; });
  player.play('https://example.com/stream.m3u8');

  FakeHls.instances[0].trigger('error', { fatal: false, details: 'bufferStall' });

  assert.equal(receivedError, null);
});

test('play() falls back to native playback when Hls.js is unsupported', () => {
  FakeHls.supported = false;
  const video = createFakeVideo({ canPlayHls: true });
  const player = createPlayer(video, { HlsCtor: FakeHls });

  player.play('https://example.com/stream.m3u8');

  assert.equal(video.src, 'https://example.com/stream.m3u8');
});

test('play() reports an error when neither Hls.js nor native HLS is available', () => {
  FakeHls.supported = false;
  const video = createFakeVideo({ canPlayHls: false });
  const player = createPlayer(video, { HlsCtor: FakeHls });

  let receivedError = null;
  player.onError((err) => { receivedError = err; });
  player.play('https://example.com/stream.m3u8');

  assert.ok(receivedError);
  assert.match(receivedError.message, /not supported/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/player.test.js`
Expected: FAIL — `Cannot find module '../src/player.js'`.

- [ ] **Step 3: Implement `src/player.js`**

```javascript
export function createPlayer(videoEl, { HlsCtor = (typeof window !== 'undefined' ? window.Hls : undefined) } = {}) {
  let hls = null;
  let errorHandler = () => {};

  function onError(handler) {
    errorHandler = handler;
  }

  function destroy() {
    if (hls) {
      hls.destroy();
      hls = null;
    }
  }

  function play(url) {
    destroy();
    videoEl.removeAttribute('src');

    if (HlsCtor && HlsCtor.isSupported()) {
      hls = new HlsCtor();
      hls.on(HlsCtor.Events.ERROR, (_event, data) => {
        if (data && data.fatal) {
          errorHandler(new Error(data.details || 'Playback failed'));
        }
      });
      hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
        videoEl.play().catch((err) => errorHandler(err));
      });
      hls.loadSource(url);
      hls.attachMedia(videoEl);
      return;
    }

    if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = url;
      videoEl.addEventListener('error', () => errorHandler(new Error('Playback failed')), { once: true });
      videoEl.play().catch((err) => errorHandler(err));
      return;
    }

    errorHandler(new Error('HLS playback is not supported in this browser'));
  }

  return { play, onError, destroy };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/player.test.js`
Expected: PASS — 5 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/player.js test/player.test.js
git commit -m "Add Hls.js player wrapper with native fallback"
```

---

### Task 5: UI, HTML shell, app wiring, and manual verification

**Files:**
- Create: `src/ui.js`
- Create: `app.js`
- Create: `index.html`
- Create: `style.css`
- Create: `README.md`

**Interfaces:**
- Consumes: `SADC_COUNTRIES` (Task 1), `loadChannels` (Task 3), `createPlayer` (Task 4), `loadFavorites`/`toggleFavorite`/`isFavorite`/`getLastWatched`/`setLastWatched` (Task 2).
- Produces: `renderApp({ root, channels, favoritesApi, onSelectChannel }): { refresh(): void }` from `src/ui.js`, where `favoritesApi = { isFavorite(url): boolean, toggle(url): void }`.

- [ ] **Step 1: Run the full automated test suite to confirm Tasks 1–4 are still green**

Run: `npm test`
Expected: PASS — 14 tests total (3 parser + 3 storage + 3 playlist + 5 player), 0 failures.

- [ ] **Step 2: Create `src/ui.js`**

```javascript
import { SADC_COUNTRIES } from './constants.js';

export function renderApp({ root, channels, favoritesApi, onSelectChannel }) {
  root.innerHTML = `
    <aside class="sidebar">
      <input type="search" id="search-box" placeholder="Search channels..." />
      <select id="country-filter"><option value="">All countries</option></select>
      <select id="category-filter"><option value="">All categories</option></select>
      <label class="favorites-label">
        <input type="checkbox" id="favorites-toggle" /> Favorites only
      </label>
      <ul id="channel-list"></ul>
    </aside>
  `;

  const searchBox = root.querySelector('#search-box');
  const countrySelect = root.querySelector('#country-filter');
  const categorySelect = root.querySelector('#category-filter');
  const favoritesToggle = root.querySelector('#favorites-toggle');
  const listEl = root.querySelector('#channel-list');

  const countries = [...new Set(channels.map((c) => c.country))].sort();
  for (const code of countries) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = SADC_COUNTRIES[code] || code;
    countrySelect.appendChild(opt);
  }

  const categories = [...new Set(channels.map((c) => c.category).filter(Boolean))].sort();
  for (const category of categories) {
    const opt = document.createElement('option');
    opt.value = category;
    opt.textContent = category;
    categorySelect.appendChild(opt);
  }

  function applyFilters() {
    const search = searchBox.value.trim().toLowerCase();
    const country = countrySelect.value;
    const category = categorySelect.value;
    const favoritesOnly = favoritesToggle.checked;

    const filtered = channels.filter((channel) => {
      if (search && !channel.name.toLowerCase().includes(search)) return false;
      if (country && channel.country !== country) return false;
      if (category && channel.category !== category) return false;
      if (favoritesOnly && !favoritesApi.isFavorite(channel.url)) return false;
      return true;
    });

    renderList(filtered);
  }

  function renderList(list) {
    listEl.innerHTML = '';
    for (const channel of list) {
      const item = document.createElement('li');
      item.className = 'channel-item';
      item.textContent = channel.name;

      const favButton = document.createElement('button');
      favButton.type = 'button';
      favButton.className = 'favorite-btn';
      favButton.textContent = favoritesApi.isFavorite(channel.url) ? '★' : '☆';
      favButton.addEventListener('click', (event) => {
        event.stopPropagation();
        favoritesApi.toggle(channel.url);
        applyFilters();
      });

      item.appendChild(favButton);
      item.addEventListener('click', () => onSelectChannel(channel));
      listEl.appendChild(item);
    }
  }

  searchBox.addEventListener('input', applyFilters);
  countrySelect.addEventListener('change', applyFilters);
  categorySelect.addEventListener('change', applyFilters);
  favoritesToggle.addEventListener('change', applyFilters);

  applyFilters();

  return { refresh: applyFilters };
}
```

- [ ] **Step 3: Create `app.js`**

```javascript
import { loadChannels } from './src/playlist.js';
import { renderApp } from './src/ui.js';
import { createPlayer } from './src/player.js';
import {
  isFavorite,
  toggleFavorite,
  getLastWatched,
  setLastWatched,
} from './src/storage.js';

async function main() {
  const root = document.getElementById('app');
  const videoEl = document.getElementById('video');
  const statusEl = document.getElementById('player-status');
  const retryButton = document.getElementById('retry-button');

  const favoritesApi = {
    isFavorite: (url) => isFavorite(window.localStorage, url),
    toggle: (url) => toggleFavorite(window.localStorage, url),
  };

  const player = createPlayer(videoEl);
  player.onError((err) => {
    statusEl.textContent = `Can't play this channel: ${err.message}`;
    statusEl.hidden = false;
  });

  function selectChannel(channel) {
    statusEl.hidden = true;
    setLastWatched(window.localStorage, channel.url);
    player.play(channel.url);
  }

  async function boot() {
    retryButton.hidden = true;
    root.textContent = 'Loading channels...';

    try {
      const channels = await loadChannels({
        fetchImpl: window.fetch.bind(window),
        sessionStore: window.sessionStorage,
      });

      renderApp({ root, channels, favoritesApi, onSelectChannel: selectChannel });

      const lastWatchedUrl = getLastWatched(window.localStorage);
      const lastChannel = channels.find((c) => c.url === lastWatchedUrl);
      if (lastChannel) {
        selectChannel(lastChannel);
      }
    } catch (err) {
      root.textContent = `Failed to load channel list: ${err.message}`;
      retryButton.hidden = false;
    }
  }

  retryButton.addEventListener('click', boot);
  boot();
}

main();
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SADC IPTV Player</title>
  <link rel="stylesheet" href="style.css" />
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js"></script>
</head>
<body>
  <main class="layout">
    <div class="sidebar-column">
      <div id="app">Loading channels...</div>
      <button id="retry-button" type="button" hidden>Retry loading channels</button>
    </div>
    <section class="player-panel">
      <video id="video" controls></video>
      <p id="player-status" hidden></p>
    </section>
  </main>
  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 5: Create `style.css`**

```css
:root {
  color-scheme: dark;
  --bg: #12141a;
  --panel: #1b1e27;
  --accent: #4da3ff;
  --text: #e6e6e6;
  --muted: #8a8f9c;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
}

.layout {
  display: flex;
  height: 100vh;
}

.sidebar-column {
  width: 320px;
  display: flex;
  flex-direction: column;
}

.sidebar {
  flex: 1;
  background: var(--panel);
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sidebar input[type="search"],
.sidebar select {
  width: 100%;
  padding: 0.4rem;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--muted);
  border-radius: 4px;
}

.favorites-label {
  color: var(--muted);
  font-size: 0.9rem;
}

#channel-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
}

.channel-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  cursor: pointer;
  border-bottom: 1px solid #2a2d38;
}

.channel-item:hover {
  background: #262a35;
}

.favorite-btn {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 1.1rem;
}

#retry-button {
  margin: 1rem;
  padding: 0.5rem 1rem;
}

.player-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  gap: 0.75rem;
}

#video {
  width: 100%;
  max-width: 960px;
  background: black;
}

#player-status {
  color: #ff6b6b;
}
```

- [ ] **Step 6: Create `README.md`**

```markdown
# SADC IPTV Player

Browse and watch free-to-air channels from SADC countries, sourced live
from the [iptv-org/iptv](https://github.com/iptv-org/iptv) playlist.

## Run it

No build step, no dependencies to install. Serve the folder with any
static file server, for example:

    python -m http.server 8080

or:

    npx serve .

Then open http://localhost:8080 in a browser.

## Run the tests

Requires Node 18+.

    npm test
```

- [ ] **Step 7: Manually verify in a browser**

Serve the project (`python -m http.server 8080` from the project root) and open it in a browser. Check each of the following:

1. The channel list loads and shows only SADC-country channels (South Africa, DR Congo, Tanzania, Mozambique, Namibia, Angola, Zimbabwe — the countries actually present in the current playlist).
2. Typing in the search box narrows the list by channel name.
3. Selecting a country or category from the dropdowns filters the list correctly; clearing back to "All ..." restores the full list.
4. Clicking a channel starts playback in the video panel.
5. If a channel fails to play, the "Can't play this channel: ..." message appears in the player panel and the rest of the list remains usable.
6. Clicking the star icon next to a channel favorites/unfavorites it; toggling "Favorites only" shows just favorited channels.
7. Reload the page: the previously playing channel resumes automatically, and favorites are still marked.

- [ ] **Step 8: Commit**

```bash
git add src/ui.js app.js index.html style.css README.md
git commit -m "Wire up UI, playback, and app entry point"
```
