import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  readJson,
  REGISTRY_PATH,
  ROOT_DIR,
  writeJson,
} from './playlist-tools.mjs';

const NEOTV_ENDPOINT = 'https://livetv.neotvapp.com/wp-admin/admin-ajax.php';
const SOURCE_NAME = 'NeoTV+ public FAST catalog';
const PUBLIC_LOGO_BASE = 'https://mangezi.xyz/tv/assets/channels/neotv';
const LOCAL_LOGO_DIR = path.join(ROOT_DIR, 'assets', 'channels', 'neotv');

const APPROVED_CHANNELS = new Map([
  ['Fite TV', { id: 'NeoTVPlus.FiteTV', name: 'Fite TV', logoFile: 'fite-tv.png' }],
  ['Fight TV', { id: 'NeoTVPlus.FightTV', name: 'Fight TV', logoFile: 'fight-tv.jpg' }],
  ['Cricket Gold', { id: 'NeoTVPlus.CricketGold', name: 'Cricket Gold', logoFile: 'cricket-gold.jpg' }],
  ['Goal TV', { id: 'NeoTVPlus.GoalTV', name: 'Goal TV', logoFile: 'goal-tv.jpg' }],
  ['GOLF Network', { id: 'NeoTVPlus.GolfNetwork', name: 'Golf Network', logoFile: 'golf-network.png' }],
  ['Xtrem Sports', { id: 'NeoTVPlus.XtremSports', name: 'Xtrem Sports', logoFile: 'xtrem-sports.png' }],
  ['Nautical', { id: 'NeoTVPlus.Nautical', name: 'Nautical', logoFile: 'nautical.jpg' }],
  ['SPORT FISHING TV', { id: 'NeoTVPlus.SportFishingTV', name: 'Sport Fishing TV', logoFile: 'sport-fishing-tv.jpg' }],
  ['Kozoon Billiard', { id: 'NeoTVPlus.KozoomBilliards', name: 'Kozoom Billiards', logoFile: 'kozoom-billiards.jpg', group: 'Cue Sports' }],
]);

const ALLOWED_STREAM_HOSTS = new Set([
  'streams2.sofast.tv',
  'd13f5ho7dp9xg4.cloudfront.net',
  'd17d533u08po4z.cloudfront.net',
]);

const response = await fetch(NEOTV_ENDPOINT, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    action: 'livetv_get_channels',
    category: 'Sports',
    region: 'global',
  }),
});

if (!response.ok) throw new Error(`NeoTV+ returned HTTP ${response.status}`);
const payload = await response.json();
if (!payload?.success || !Array.isArray(payload?.data?.items)) {
  throw new Error('NeoTV+ returned an unexpected sports catalog response');
}

const upstreamByName = new Map(
  payload.data.items.map((channel) => [channel.channel_name.trim(), channel]),
);
const registry = await readJson(REGISTRY_PATH);
const verifiedOn = new Date().toISOString().slice(0, 10);
let added = 0;
let updated = 0;

await mkdir(LOCAL_LOGO_DIR, { recursive: true });

for (const [upstreamName, approved] of APPROVED_CHANNELS) {
  const upstream = upstreamByName.get(upstreamName);
  if (!upstream) throw new Error(`Approved NeoTV+ channel is missing: ${upstreamName}`);

  const streamUrl = new URL(upstream.stream_url);
  if (streamUrl.protocol !== 'https:' || !ALLOWED_STREAM_HOSTS.has(streamUrl.hostname)) {
    throw new Error(`Unapproved NeoTV+ stream host for ${upstreamName}: ${streamUrl.hostname}`);
  }

  const logoUrl = new URL(upstream.image);
  if (logoUrl.protocol !== 'https:' || logoUrl.hostname !== 'cdn.neotvapp.com') {
    throw new Error(`Unapproved NeoTV+ logo host for ${upstreamName}: ${logoUrl.hostname}`);
  }

  const logoResponse = await fetch(logoUrl);
  if (!logoResponse.ok) throw new Error(`Logo download failed for ${upstreamName}`);
  const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
  if (logoBytes.length < 512) throw new Error(`Logo download was unexpectedly small for ${upstreamName}`);
  await writeFile(path.join(LOCAL_LOGO_DIR, approved.logoFile), logoBytes);

  const channel = {
    id: approved.id,
    name: approved.name,
    group: approved.group || 'Sports',
    logo: `${PUBLIC_LOGO_BASE}/${approved.logoFile}`,
    source: SOURCE_NAME,
    primaryUrl: upstream.stream_url,
    backupUrls: [],
    outputs: ['main', 'sports'],
    notes: `Public ad-supported HLS from the NeoTV+ worldwide sports catalog; verified from South Africa on ${verifiedOn}.`,
  };

  const existingIndex = registry.channels.findIndex((candidate) => candidate.id === channel.id);
  if (existingIndex >= 0) {
    registry.channels[existingIndex] = channel;
    updated += 1;
  } else {
    registry.channels.push(channel);
    added += 1;
  }
}

registry.updated = new Date().toISOString();
await writeJson(REGISTRY_PATH, registry);
console.log(`NeoTV+ sports import complete: added=${added}, updated=${updated}`);
