import { parseM3U, readJson, writeJson, REGISTRY_PATH, ROOT_DIR } from './playlist-tools.mjs';
import { probeStream, mapConcurrent } from './stream-probe.mjs';
import path from 'node:path';
import { isExcludedRegionalChannel, isEnglishOnlyFeed } from './channel-policy.mjs';

const sourceUrl = 'https://iptv-org.github.io/iptv/languages/eng.m3u';
const metadataUrl = 'https://iptv-org.github.io/api/channels.json';
const feedsUrl = 'https://iptv-org.github.io/api/feeds.json';
async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Source HTTP ${response.status}: ${url}`);
  return response.text();
}
const [playlist, metadataText, feedsText, registry] = await Promise.all([
  download(sourceUrl), download(metadataUrl), download(feedsUrl), readJson(REGISTRY_PATH),
]);
const metadata = new Map(JSON.parse(metadataText).map((channel) => [channel.id, channel]));
const feeds = new Map(JSON.parse(feedsText).map((feed) => [`${feed.channel}@${feed.id}`, feed]));
const excludedRegional = (channel) => isExcludedRegionalChannel(channel, metadata.get(channel.id?.split('@')[0]), feeds.get(channel.id));
const upstream = parseM3U(playlist).entries.filter((channel) => !excludedRegional(channel) && isEnglishOnlyFeed(channel, feeds.get(channel.id)));
if (upstream.length < 100) throw new Error('English source unexpectedly small; registry left unchanged');
const baseId = (id) => id?.split('@')[0];
const candidates = new Map();
for (const channel of registry.channels) {
  for (const url of [channel.primaryUrl, ...(channel.backupUrls || [])]) candidates.set(url, null);
}
for (const channel of upstream) candidates.set(channel.primaryUrl, null);
console.log(`Probing ${candidates.size} distinct feeds, including ${registry.channels.length} existing entries`);
let completed = 0;
await mapConcurrent([...candidates.keys()], 36, async (url) => {
  candidates.set(url, await probeStream(url, 9000));
  if (++completed % 250 === 0) console.log(`Checked ${completed}/${candidates.size}`);
});
// Retry existing failures at lower concurrency before withdrawing them.
const retry = [...new Set(registry.channels.flatMap((c) => [c.primaryUrl, ...(c.backupUrls || [])]))]
  .filter((url) => !candidates.get(url)?.ok);
await mapConcurrent(retry, 8, async (url) => candidates.set(url, await probeStream(url, 15000)));
const upstreamById = new Map();
for (const channel of upstream) {
  if (!channel.id || !candidates.get(channel.primaryUrl)?.ok) continue;
  const id = baseId(channel.id);
  if (!upstreamById.has(id)) upstreamById.set(id, []);
  upstreamById.get(id).push(channel);
}
const now = new Date().toISOString();
const audit = { checkedAt: now, sourceUrl, probedFeeds: candidates.size, added: [], repaired: [], withdrawn: [], retained: 0, probes: Object.fromEntries(candidates) };
const existingIds = new Set(registry.channels.map((channel) => baseId(channel.id)));
for (const channel of registry.channels) {
  if (excludedRegional(channel)) {
    channel.status = 'disabled';
    channel.notes = 'Excluded by the retained USA/UK local and regional channel exception.';
    continue;
  }
  if (channel.source === sourceUrl && !isEnglishOnlyFeed(channel, feeds.get(channel.id))) {
    channel.status = 'disabled';
    channel.notes = 'Excluded by the English-only language filter.';
    continue;
  }
  const oldUrl = channel.primaryUrl;
  const alternatives = upstreamById.get(baseId(channel.id)) || [];
  const working = [...new Set([oldUrl, ...(channel.backupUrls || []), ...alternatives.map((c) => c.primaryUrl)])]
    .filter((url) => candidates.get(url)?.ok);
  if (!working.length) {
    channel.status = 'disabled';
    channel.notes = `Withdrawn ${now.slice(0, 10)}: manifest/media probe failed twice; retained for future repair.`;
    audit.withdrawn.push({ id: channel.id, name: channel.name, reason: candidates.get(oldUrl)?.error });
    continue;
  }
  delete channel.status;
  channel.primaryUrl = working[0];
  channel.backupUrls = working.slice(1, 4);
  channel.languages = ['eng'];
  if (oldUrl !== channel.primaryUrl) audit.repaired.push({ id: channel.id, name: channel.name, oldUrl, newUrl: channel.primaryUrl });
  else audit.retained++;
}
for (const [id, variants] of upstreamById) {
  if (existingIds.has(id)) continue;
  const source = variants[0];
  const info = metadata.get(id);
  const sports = info?.categories?.includes('sports');
  registry.channels.push({
    id: source.id, name: source.name, group: sports ? 'Sports' : info?.country === 'US' ? 'USA' : info?.country === 'UK' ? 'UK' : 'International', logo: source.logo,
    source: sourceUrl, languages: ['eng'], primaryUrl: source.primaryUrl,
    backupUrls: [...new Set(variants.slice(1).map((c) => c.primaryUrl))].slice(0, 3),
    outputs: sports ? ['main', 'sports'] : ['main'],
    notes: `Listed in upstream English playlist; manifest and media segment checked ${now.slice(0, 10)}. Region restrictions may apply.`,
  });
  audit.added.push({ id: source.id, name: source.name });
}
registry.updated = now;
registry.rules = { allowedLanguages: ['eng'], excludeUsUkRegional: true };
registry.outputs.main.description = 'Worldwide English channels';
for (const [name, output] of Object.entries(registry.outputs)) {
  output.header = ['#EXTM3U', '# Generated from playlists/channels.json.',
    name === 'sports' ? '# English sports worldwide; USA/UK local and regional exceptions retained.' : '# English channels worldwide; USA/UK local and regional exceptions retained.',
    '# Active feeds passed manifest and media-segment probes at last refresh; availability can change.'];
}
await writeJson(REGISTRY_PATH, registry);
await writeJson(path.join(ROOT_DIR, 'build', 'refresh-probes.json'), audit.probes);
delete audit.probes;
audit.activeCount = registry.channels.filter((c) => c.status !== 'disabled').length;
await writeJson(path.join(ROOT_DIR, 'playlists', 'refresh-audit.json'), audit);
console.log(`Added=${audit.added.length}, repaired=${audit.repaired.length}, withdrawn=${audit.withdrawn.length}, retained=${audit.retained}. Active=${registry.channels.filter((c) => c.status !== 'disabled').length}`);
