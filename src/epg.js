export const EPG_MAX_BYTES = 20 * 1024 * 1024;

export function parseXmltvTime(value) {
  const m = String(value || '').match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*(Z|[+-]\d{4})?$/);
  if (!m) return NaN;
  const [, y, month, day, hour, minute, second = '00', zone = 'Z'] = m;
  const utc = Date.UTC(+y, +month - 1, +day, +hour, +minute, +second);
  const d = new Date(utc);
  if (d.getUTCFullYear() !== +y || d.getUTCMonth() !== +month - 1 || d.getUTCDate() !== +day
      || +hour > 23 || +minute > 59 || +second > 59) return NaN;
  const offsetHours = zone === 'Z' ? 0 : +zone.slice(1, 3);
  const offsetMinutes = zone === 'Z' ? 0 : +zone.slice(3, 5);
  if (offsetHours > 23 || offsetMinutes > 59) return NaN;
  const offset = (offsetHours * 60 + offsetMinutes) * 60000 * (zone[0] === '-' ? -1 : 1);
  return utc - offset;
}

export function parseXmltv(text, Parser = globalThis.DOMParser, now = Date.now()) {
  if (new TextEncoder().encode(text).length > EPG_MAX_BYTES) throw new Error('Guide exceeds 20 MB. Use a smaller guide.');
  const doc = new Parser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror') || doc.documentElement?.tagName !== 'tv') {
    throw new Error('This is not a valid XMLTV guide.');
  }
  const channels = [];
  const programmes = Object.create(null);
  for (const element of doc.querySelectorAll('tv > channel')) {
    const id = element.getAttribute('id');
    if (!id || Object.hasOwn(programmes, id)) continue;
    channels.push({ id, names: [...element.querySelectorAll('display-name')].map(n => n.textContent.trim()) });
    programmes[id] = [];
  }
  for (const element of doc.querySelectorAll('tv > programme')) {
    const id = element.getAttribute('channel');
    const start = parseXmltvTime(element.getAttribute('start'));
    const stop = parseXmltvTime(element.getAttribute('stop'));
    const title = element.querySelector('title')?.textContent.trim();
    if (!id || !title || !Number.isFinite(start) || !Number.isFinite(stop) || stop <= start
        || stop <= now - 86400000 || start > now + 8 * 86400000) continue;
    if (!Object.hasOwn(programmes, id)) { programmes[id] = []; channels.push({ id, names: [] }); }
    programmes[id].push({ start, stop, title, description: element.querySelector('desc')?.textContent.trim().slice(0, 2000) || '' });
  }
  for (const entries of Object.values(programmes)) entries.sort((a, b) => a.start - b.start);
  if (!Object.values(programmes).some(entries => entries.length)) throw new Error('The guide has no recent or upcoming programmes with start and stop times.');
  return { channels, programmes, loadedAt: now };
}

function normalizedName(name) {
  return String(name || '').replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/\b(?:HD|FHD|UHD|SD|4K)\b/gi, '')
    .toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

export function matchGuideChannel(guide, channel, manualId = '') {
  if (!guide || !channel) return '';
  if (manualId && Object.hasOwn(guide.programmes, manualId)) return manualId;
  const variants = [channel, ...(channel.variants || [])];
  for (const variant of variants) {
    const id = variant.tvgId || '';
    for (const candidate of [id, id.split('@')[0]]) {
      if (candidate && Object.hasOwn(guide.programmes, candidate)) return candidate;
    }
  }
  const name = normalizedName(channel.name);
  const matches = guide.channels.filter(c => c.names.some(n => normalizedName(n) === name));
  return name && matches.length === 1 ? matches[0].id : '';
}

export function getGuideSchedule(guide, channelId, now = Date.now()) {
  const entries = guide?.programmes[channelId] || [];
  return { current: entries.find(p => p.start <= now && p.stop > now) || null,
    upcoming: entries.filter(p => p.start > now).slice(0, 12) };
}

export async function decodeGuideBytes(bytes) {
  if (bytes.byteLength > EPG_MAX_BYTES) throw new Error('Guide exceeds 20 MB.');
  let stream = new Blob([bytes]).stream();
  const view = new Uint8Array(bytes);
  if (view[0] === 0x1f && view[1] === 0x8b) {
    if (!globalThis.DecompressionStream) throw new Error('Please import an uncompressed XML file on this device.');
    stream = stream.pipeThrough(new DecompressionStream('gzip'));
  }
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let size = 0; let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > EPG_MAX_BYTES) throw new Error('Uncompressed guide exceeds 20 MB.');
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { await reader.cancel(); }
}

async function guideCache(record) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('rugare-epg', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('guide');
    request.onerror = () => reject(new Error('Guide cache unavailable.'));
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('guide', record === undefined ? 'readonly' : 'readwrite');
      const action = record === undefined ? tx.objectStore('guide').get('current')
        : record === null ? tx.objectStore('guide').delete('current') : tx.objectStore('guide').put(record, 'current');
      let result;
      action.onsuccess = () => { result = action.result; };
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => { db.close(); reject(new Error('Guide could not be saved.')); };
    };
  });
}

export function createEpgController({ storage, androidBridge = null }) {
  let guide = null; let channel = null; let source = ''; let generation = 0;
  let requestId = Math.floor(Math.random() * 1000000000);
  let mappings = {};
  try { mappings = JSON.parse(storage.getItem('rugare-epg:mappings') || '{}'); } catch { /* corrupt settings */ }
  if (!mappings || typeof mappings !== 'object' || Array.isArray(mappings)) mappings = {};
  const mappingKey = () => channel?.tvgId || channel?.url || '';
  const status = message => { const el = document.getElementById('epg-status'); if (el) el.textContent = message; };
  const formatTime = value => new Date(value).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });

  function render() {
    const panel = document.getElementById('programme-guide');
    if (!panel) return;
    panel.hidden = !channel;
    const list = document.getElementById('epg-programmes');
    list.replaceChildren();
    const id = matchGuideChannel(guide, channel, mappings[mappingKey()]);
    const schedule = getGuideSchedule(guide, id);
    const label = document.getElementById('epg-channel-label');
    label.textContent = channel?.name || '';
    const hint = document.getElementById('epg-hint');
    hint.textContent = !guide ? 'Add an XMLTV guide in Settings → Program guide.'
      : !id ? 'No matching guide channel. Choose a guide channel below.'
      : !schedule.current && !schedule.upcoming.length ? 'No guide data for this time. Refresh the guide in Settings.' : '';
    document.getElementById('epg-now-next').textContent = schedule.current
      ? `Now: ${schedule.current.title}${schedule.upcoming[0] ? ' · Next: ' + schedule.upcoming[0].title : ''}`
      : schedule.upcoming[0] ? `Next: ${schedule.upcoming[0].title}` : 'No guide data';
    for (const [i, programme] of [schedule.current, ...schedule.upcoming].filter(Boolean).entries()) {
      const li = document.createElement('li');
      const title = document.createElement('strong');
      title.textContent = `${i === 0 && schedule.current ? 'Now · ' : ''}${formatTime(programme.start)}–${new Date(programme.stop).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${programme.title}`;
      li.append(title);
      if (programme.description) { const desc = document.createElement('p'); desc.textContent = programme.description; li.append(desc); }
      list.append(li);
    }
    const select = document.getElementById('epg-channel-match');
    select.disabled = !guide;
    select.value = mappings[mappingKey()] || '';
  }

  function populateMatches() {
    const select = document.getElementById('epg-channel-match');
    select.replaceChildren(new Option('Automatic matching', ''));
    for (const item of guide?.channels || []) select.add(new Option(`${item.names[0] || item.id} (${item.id})`, item.id));
  }

  async function install(text, url, name, token) {
    const parsed = parseXmltv(text);
    if (token !== generation) return;
    const record = { guide: parsed, source: url, name };
    guide = parsed; source = url;
    populateMatches(); render();
    const input = document.getElementById('epg-url'); if (input) input.value = url;
    const count = parsed.channels.filter(c => parsed.programmes[c.id]?.length).length;
    status(`Loaded ${count} guide channels from ${name}. Times use your device timezone.`);
    try { await guideCache(record); } catch { status(`Guide loaded for this session; could not save it. ${count} guide channels.`); }
  }

  async function fetchGuide(url) {
    const uri = new URL(url);
    if (!['http:', 'https:'].includes(uri.protocol)) throw new Error('Use an HTTP or HTTPS XMLTV URL.');
    if (typeof androidBridge?.fetchEpg === 'function') {
      const id = ++requestId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { cleanup(); reject(new Error('Guide download timed out.')); }, 35000);
        const listener = event => {
          if (event.detail?.request !== id) return;
          cleanup();
          if (event.detail.error) reject(new Error(event.detail.error)); else resolve(event.detail.text);
        };
        function cleanup() { clearTimeout(timer); window.removeEventListener('rugare-epg-download', listener); }
        window.addEventListener('rugare-epg-download', listener);
        try { androidBridge.fetchEpg(uri.href, id); } catch (error) { cleanup(); reject(error); }
      });
    }
    const response = await fetch(uri.href, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Guide download failed (HTTP ${response.status}).`);
    if (+response.headers.get('content-length') > EPG_MAX_BYTES) throw new Error('Guide exceeds 20 MB.');
    const reader = response.body.getReader(); const chunks = []; let size = 0;
    try {
      while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length;
        if (size > EPG_MAX_BYTES) throw new Error('Guide exceeds 20 MB.'); chunks.push(value); }
    } finally { await reader.cancel(); }
    return decodeGuideBytes(await new Blob(chunks).arrayBuffer());
  }

  async function loadUrl() {
    const url = document.getElementById('epg-url')?.value.trim() || source;
    if (!url) { status('Paste your provider’s XMLTV URL, or import an XML/XML.GZ file.'); return; }
    const token = ++generation; status('Loading program guide…');
    try { await install(await fetchGuide(url), url, 'XMLTV URL', token); }
    catch (error) { if (token === generation) status(`${error.message} You can download the guide and import the file instead.`); }
  }

  return {
    setChannel(value) { channel = value; render(); },
    async bind() {
      const input = document.getElementById('epg-url'); if (input) input.value = source;
      populateMatches(); render();
      document.getElementById('epg-example').addEventListener('change', event => {
        if (event.target.value) input.value = event.target.value;
      });
      document.getElementById('epg-refresh').addEventListener('click', loadUrl);
      document.getElementById('epg-file').addEventListener('change', async event => {
        const file = event.target.files?.[0]; if (!file) return;
        const token = ++generation; status('Reading program guide…');
        try { if (file.size > EPG_MAX_BYTES) throw new Error('Guide exceeds 20 MB.');
          await install(await decodeGuideBytes(await file.arrayBuffer()), '', file.name, token); }
        catch (error) { if (token === generation) status(error.message); }
        event.target.value = '';
      });
      document.getElementById('epg-clear').addEventListener('click', async () => {
        ++generation; guide = null; source = ''; mappings = {}; input.value = '';
        storage.removeItem('rugare-epg:mappings'); populateMatches(); render(); status('Guide removed.');
        try { await guideCache(null); } catch { status('Guide removed from this session; cache could not be cleared.'); }
      });
      document.getElementById('epg-channel-match').onchange = event => {
        mappings[mappingKey()] = event.target.value;
        try { storage.setItem('rugare-epg:mappings', JSON.stringify(mappings)); } catch { status('Channel match applies to this session only.'); }
        render();
      };
    },
    async restore() {
      const token = generation;
      try { const cached = await guideCache(); if (token !== generation || !cached?.guide
          || !Array.isArray(cached.guide.channels) || !cached.guide.programmes
          || !Number.isFinite(cached.guide.loadedAt)) return;
        guide = cached.guide; source = cached.source || ''; populateMatches(); render();
        const input = document.getElementById('epg-url'); if (input) input.value = source;
        status(`Saved guide from ${new Date(guide.loadedAt).toLocaleString()}. Refresh to update schedules.`);
        if (source && Date.now() - guide.loadedAt > 6 * 3600000) await loadUrl();
      } catch { /* Guide import remains available without persistent storage. */ }
    },
    start() { setInterval(render, 60000); },
  };
}
