import path from 'node:path';
import {
  parseM3U,
  playlistPath,
  readText,
  REGISTRY_PATH,
  registryKey,
  writeJson,
} from './playlist-tools.mjs';

const OUTPUTS = {
  main: {
    path: 'playlists/english-africa-uk-us-verified.m3u',
    description: 'Main English Africa/UK/USA playlist',
  },
  sports: {
    path: 'playlists/sports-africa-uk-us-verified.m3u',
    description: 'Sports-only playlist',
  },
};

const RULES = {
  allowedGroups: ['Africa', 'UK', 'USA', 'Sports', 'Cue Sports', 'International'],
  excludedTitlePatterns: [
    'Afghan',
    'Afghanistan',
    'Brit\\s*Asia',
    'BritAsia',
    'Latin',
    'LatAm',
    'Latino',
    'Hispanic',
    'Spanish',
    'Espanol',
    'Español',
    'Portuguese',
    'Brazil',
    'Brasil',
    'French',
    'Français',
    'German',
    'Greece',
    'Italy',
    'Italian',
    'Poland',
    'Bangla',
    'Urdu',
    'Arabic',
    'Persia',
    'Persian',
    'Hindi',
    'Korean',
    'KPOP',
    'Viki',
    '\\bZee\\b',
    'Deportes',
    'Esportes',
    'Fútbol',
    'Futbol',
    'Religious',
    'Faith',
    'Gospel',
    'Church',
    'Bible',
    '\\bTBN\\b',
    'GODTV',
    'God TV',
    'HopeChannel',
    'Yadah',
    'Ministry',
    'Miracle',
    'Islam',
    'MTA\\d',
    'SABC1',
    'SABC2',
    'SABC3',
    'SABC 1',
    'SABC 2',
    'SABC 3',
    'Geo-blocked',
    'Geo locked',
    'Geo-locked',
    'ZA IP only',
    '\\bABC\\s+(?!News Live\\b)',
    '\\bCBS\\s+(?!News 24/7\\b)',
    'Estrella News',
    'ENT Family',
    'Magna Vision',
    'BBC Earth Greece',
    '^Channel S(?:\\s|$|\\()',
    'DAZN Combat',
  ],
};

const HEADER_OVERRIDES = {
  main: [
    '#EXTM3U',
    '# Generated from playlists/channels.json.',
    '# Guardrails: English only, no religious channels, no geo-locked channels, no ABC/CBS metro variants.',
    '# SABC News and SABC Lehae are restored after direct HLS verification; SABC 1/2/3 remain excluded.',
    '# Folders intentionally reduced to: Africa, UK, USA, Sports, Cue Sports, International.',
  ],
  sports: [
    '#EXTM3U',
    '# Generated from playlists/channels.json.',
    '# Guardrails: English sports only, no religious channels, no geo-locked channels, no FIFA/FIFA+ or DAZN Combat.',
  ],
};

const merged = new Map();
const outputHeaders = {};

for (const [outputName, output] of Object.entries(OUTPUTS)) {
  const { header, entries } = parseM3U(await readText(playlistPath(output.path)));
  outputHeaders[outputName] = HEADER_OVERRIDES[outputName] || header;

  for (const entry of entries) {
    const key = registryKey(entry);
    const existing = merged.get(key) || {
      id: entry.id,
      name: entry.name,
      group: entry.group,
      logo: entry.logo,
      source: inferSource(entry),
      primaryUrl: entry.primaryUrl,
      backupUrls: [],
      outputs: [],
      notes: '',
    };

    if (!existing.outputs.includes(outputName)) existing.outputs.push(outputName);
    merged.set(key, existing);
  }
}

const registry = {
  schemaVersion: 1,
  updated: new Date().toISOString(),
  rules: RULES,
  outputs: Object.fromEntries(
    Object.entries(OUTPUTS).map(([name, output]) => [
      name,
      {
        ...output,
        header: outputHeaders[name],
      },
    ]),
  ),
  channels: [...merged.values()],
};

await writeJson(REGISTRY_PATH, registry);
console.log(
  `Exported ${registry.channels.length} channels to ${path.relative(process.cwd(), REGISTRY_PATH)}`,
);

function inferSource(entry) {
  if (/^(wh\.|RakutenTV-UK_)/i.test(entry.id)) return 'WirelessHack-listed FAST playlist';
  if (/^(AlJazeera|France24|SABC)/i.test(entry.id)) return 'Direct verified public HLS';
  return 'iptv-org curated source';
}
