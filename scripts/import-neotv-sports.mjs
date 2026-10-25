import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  readJson,
  REGISTRY_PATH,
  ROOT_DIR,
  writeJson,
} from './playlist-tools.mjs';
import { mapConcurrent, probeStream } from './stream-probe.mjs';
import { incomingHeight, meetsIncomingQuality } from './channel-policy.mjs';

const NEOTV_ENDPOINT = 'https://livetv.neotvapp.com/wp-admin/admin-ajax.php';
const SOURCE_NAME = 'NeoTV+ public FAST catalog';
const PUBLIC_LOGO_BASE = 'https://mangezi.xyz/tv/assets/channels/neotv';
const LOCAL_LOGO_DIR = path.join(ROOT_DIR, 'assets', 'channels', 'neotv');

const channel = (name, logoFile, extra = {}) => ({
  id: `NeoTVPlus.${name.replace(/[^A-Za-z0-9]/g, '')}`,
  name,
  logoFile,
  ...extra,
});

// Sports channels are required; a missing or broken one aborts the import as before.
// Other categories are optional: a feed that fails its probe is skipped and reported.
const CATEGORIES = [
  {
    category: 'Sports',
    required: true,
    outputs: ['main', 'sports'],
    channels: new Map([
      ['Fite TV', channel('Fite TV', 'fite-tv.png')],
      ['Fight TV', channel('Fight TV', 'fight-tv.jpg')],
      ['Cricket Gold', channel('Cricket Gold', 'cricket-gold.jpg')],
      ['Sports First TV', channel('Sports First TV', 'sports-first-tv.jpg')],
      ['Goal TV', channel('Goal TV', 'goal-tv.jpg')],
      ['GOLF Network', channel('Golf Network', 'golf-network.png')],
      ['Xtrem Sports', channel('Xtrem Sports', 'xtrem-sports.png')],
      ['Nautical', channel('Nautical', 'nautical.jpg')],
      ['SPORT FISHING TV', channel('Sport Fishing TV', 'sport-fishing-tv.jpg')],
      ['Kozoon Billiard', channel('Kozoom Billiards', 'kozoom-billiards.jpg', { group: 'Cue Sports' })],
    ]),
  },
  {
    category: 'News',
    group: 'News',
    channels: new Map([
      ['NHK World', channel('NHK World', 'nhk-world.png')],
      ['CGTN Global', channel('CGTN', 'cgtn.png')],
      ['CGTN Global Biz', channel('CGTN Global Biz', 'cgtn-global-biz.png')],
    ]),
  },
  {
    category: 'Lifestyle',
    group: 'Lifestyle',
    channels: new Map([
      ['Travel 4K', channel('Travel 4K', 'travel-4k.png')],
      ['Heritage Plus', channel('Heritage Plus', 'heritage-plus.png')],
      ['Go2 Travel', channel('Go2 Travel', 'go2-travel.png')],
      ['Discovering China', channel('Discovering China', 'discovering-china.png')],
      ['Cuisine Culture', channel('Cuisine Culture', 'cuisine-culture.png')],
      ['Wine Watches Whiskey', channel('Wine Watches Whiskey', 'wine-watches-whiskey.png')],
      ['Unchained TV', channel('Unchained TV', 'unchained-tv.png')],
      ['H2O TV', channel('H2O TV', 'h2o-tv.png')],
      ['AbsintheTV', channel('Absinthe TV', 'absinthe-tv.png')],
      ['Wild TV', channel('Wild TV', 'wild-tv.png')],
      ['The Beach Channel', channel('The Beach Channel', 'the-beach-channel.png')],
      ['Hunt Fish', channel('Hunt Fish TV', 'hunt-fish-tv.png')],
      ['RV TV', channel('RV TV', 'rv-tv.png')],
      ['Yachting TV', channel('Yachting TV', 'yachting-tv.png')],
      ['Horse TV', channel('Horse TV', 'horse-tv.png')],
      ['Time2Rlx', channel('Time2Rlx', 'time2rlx.png')],
      ['WeDO Cars', channel('WeDO Cars', 'wedo-cars.png')],
    ]),
  },
  {
    category: 'Entertainment',
    group: 'Entertainment',
    channels: new Map([
      ['Best Action TV', channel('Best Action TV', 'best-action-tv.png', { group: 'Movies' })],
      ['BEST Thriller', channel('Best Thriller', 'best-thriller.png', { group: 'Movies' })],
      ['Best Drama Movies', channel('Best Drama Movies', 'best-drama-movies.png', { group: 'Movies' })],
      ['Best Classic Movies', channel('Best Classic Movies', 'best-classic-movies.png', { group: 'Movies' })],
      ['Sooner Movies 1', channel('Sooner Movies 1', 'sooner-movies-1.png', { group: 'Movies' })],
      ['Sooner Movies 2', channel('Sooner Movies 2', 'sooner-movies-2.png', { group: 'Movies' })],
      ['Cinepast', channel('Cinepast', 'cinepast.png', { group: 'Movies' })],
      ['NYX Stralight 1', channel('NYX Starlight', 'nyx-starlight.png', { group: 'Movies' })],
      ['WeDO BigStories', channel('WeDO BigStories', 'wedo-bigstories.png', { group: 'Movies' })],
      ['Tensions TV', channel('Tensions TV', 'tensions-tv.png')],
      ['Space Series', channel('Space Series', 'space-series.png')],
      ['Brat TV', channel('Brat TV', 'brat-tv.png')],
      ['Lol TV', channel('LOL TV', 'lol-tv.png')],
      ['USERIES', channel('USERIES', 'useries.png')],
      ['AWE Plus', channel('AWE Plus', 'awe-plus.png')],
      ['WeDO TV', channel('WeDO TV', 'wedo-tv.png')],
      ['Feva TV', channel('Feva TV', 'feva-tv.png')],
      ['Playzi TV', channel('Playzi TV', 'playzi-tv.png')],
      ['NetRadio Vision', channel('NetRadio Vision', 'netradio-vision.png', { group: 'Music' })],
      ['Music EDM', channel('Music EDM', 'music-edm.png', { group: 'Music' })],
      ['Epic Music', channel('Epic Music', 'epic-music.png', { group: 'Music' })],
      ['Urban Street', channel('Urban Street', 'urban-street.png', { group: 'Music' })],
      ['Summer Vibes', channel('Summer Vibes', 'summer-vibes.png', { group: 'Music' })],
      ['Rising Music', channel('Rising Music', 'rising-music.png', { group: 'Music' })],
      ['Music LO-FI', channel('Music Lo-Fi', 'music-lo-fi.png', { group: 'Music' })],
      ['Fireplace TV', channel('Fireplace TV', 'fireplace-tv.png', { group: 'Music' })],
      ['Music Synthwave', channel('Music Synthwave', 'music-synthwave.png', { group: 'Music' })],
      ['Feva Music', channel('Feva Music', 'feva-music.png', { group: 'Music' })],
    ]),
  },
  {
    category: 'Kids',
    group: 'Kids',
    channels: new Map([
      ['Cartoon Classics', channel('Cartoon Classics', 'cartoon-classics.png')],
      ['DIY Art', channel('DIY Art', 'diy-art.png')],
    ]),
  },
];

const ALLOWED_STREAM_HOSTS = new Set([
  'streams2.sofast.tv',
  'd13f5ho7dp9xg4.cloudfront.net',
  'd17d533u08po4z.cloudfront.net',
  'd2rlaw70a3lx3m.cloudfront.net',
  'ssai.aniview.com',
  'amg00735-amg00735c39-amgplt0835.playout.now3.amagi.tv',
  'amg00735-amg00735c71-amgplt0835.playout.now3.amagi.tv',
  'amg00735-amg00735c78-amgplt0835.playout.now3.amagi.tv',
  'amg00735-amg00735c80-amgplt0835.playout.now3.amagi.tv',
  'stream.playzi.tv',
  'fastlive.cctvplus.com',
  'live.nowtelly.com',
  'english-livebkali.cgtn.com',
  'media-tyo.hls.nhkworld.jp',
]);

async function fetchCategory(category) {
  const response = await fetch(NEOTV_ENDPOINT, {
    signal: AbortSignal.timeout(20000),
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ action: 'livetv_get_channels', category, region: 'global' }),
  });
  if (!response.ok) throw new Error(`NeoTV+ returned HTTP ${response.status} for ${category}`);
  const payload = await response.json();
  if (!payload?.success || !Array.isArray(payload?.data?.items)) {
    throw new Error(`NeoTV+ returned an unexpected ${category} catalog response`);
  }
  return new Map(payload.data.items.map((item) => [item.channel_name.trim(), item]));
}

async function importChannel(upstreamName, approved, upstream, definition, verifiedOn) {
  if (!upstream) throw new Error(`Approved NeoTV+ channel is missing: ${upstreamName}`);

  const streamUrl = new URL(upstream.stream_url);
  if (streamUrl.protocol !== 'https:' || !ALLOWED_STREAM_HOSTS.has(streamUrl.hostname)) {
    throw new Error(`Unapproved NeoTV+ stream host for ${upstreamName}: ${streamUrl.hostname}`);
  }

  const logoUrl = new URL(upstream.image);
  if (logoUrl.protocol !== 'https:' || logoUrl.hostname !== 'cdn.neotvapp.com') {
    throw new Error(`Unapproved NeoTV+ logo host for ${upstreamName}: ${logoUrl.hostname}`);
  }

  // Do not replace a working registry with an upstream error page or dead feed.
  const probe = await probeStream(upstream.stream_url, 20000);
  if (!probe.ok) throw new Error(`Invalid NeoTV+ HLS for ${upstreamName}: ${probe.status} ${probe.error}`);
  const isNew = !registry.channels.some((candidate) => candidate.id === approved.id);
  if (isNew && !meetsIncomingQuality(incomingHeight(probe))) {
    throw new Error(`New NeoTV+ channel ${upstreamName} is below 720p (${probe.maxHeight || 'unknown'})`);
  }

  const logoResponse = await fetch(logoUrl, { signal: AbortSignal.timeout(20000) });
  if (!logoResponse.ok) throw new Error(`Logo download failed for ${upstreamName}`);
  const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
  if (logoBytes.length < 512) throw new Error(`Logo download was unexpectedly small for ${upstreamName}`);
  // Name the file after its actual format so hosts serve the right content type.
  const isJpeg = logoBytes[0] === 0xff && logoBytes[1] === 0xd8;
  const logoFile = approved.logoFile.replace(/\.(png|jpe?g)$/i, isJpeg ? '.jpg' : '.png');
  await writeFile(path.join(LOCAL_LOGO_DIR, logoFile), logoBytes);

  return {
    id: approved.id,
    name: approved.name,
    group: approved.group || definition.group || 'Sports',
    logo: `${PUBLIC_LOGO_BASE}/${logoFile}`,
    source: SOURCE_NAME,
    primaryUrl: upstream.stream_url,
    backupUrls: [],
    outputs: definition.outputs || ['main'],
    notes: `NeoTV+ worldwide ${definition.category.toLowerCase()} catalog; HLS manifest and segment checked on ${verifiedOn}.`,
    languages: ['eng'],
  };
}

const registry = await readJson(REGISTRY_PATH);
const verifiedOn = new Date().toISOString().slice(0, 10);
const skipped = [];
let added = 0;
let updated = 0;

await mkdir(LOCAL_LOGO_DIR, { recursive: true });

for (const definition of CATEGORIES) {
  const upstreamByName = await fetchCategory(definition.category);
  const results = await mapConcurrent([...definition.channels], 6, async ([upstreamName, approved]) => {
    try {
      return await importChannel(upstreamName, approved, upstreamByName.get(upstreamName), definition, verifiedOn);
    } catch (error) {
      if (definition.required) throw error;
      skipped.push(`${upstreamName}: ${error.message}`);
      return null;
    }
  });

  for (const imported of results.filter(Boolean)) {
    const existingIndex = registry.channels.findIndex((candidate) => candidate.id === imported.id);
    if (existingIndex >= 0) {
      registry.channels[existingIndex] = { ...registry.channels[existingIndex], ...imported };
      updated += 1;
    } else {
      registry.channels.push(imported);
      added += 1;
    }
  }
}

registry.updated = new Date().toISOString();
await writeJson(REGISTRY_PATH, registry);
console.log(`NeoTV+ import complete: added=${added}, updated=${updated}, skipped=${skipped.length}`);
for (const line of skipped) console.log(`  skipped ${line}`);
