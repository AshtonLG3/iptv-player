import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export const ROOT_DIR = path.resolve(import.meta.dirname, '..');
export const PLAYLIST_DIR = path.join(ROOT_DIR, 'playlists');
export const REGISTRY_PATH = path.join(PLAYLIST_DIR, 'channels.json');
export const HEALTH_PATH = path.join(PLAYLIST_DIR, 'health.json');

export function parseM3U(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const header = [];
  const entries = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF')) {
      let url = '';
      for (let j = i + 1; j < lines.length; j += 1) {
        const candidate = lines[j].trim();
        if (!candidate || candidate.startsWith('#')) continue;
        url = candidate;
        i = j;
        break;
      }

      if (!url) continue;
      entries.push(parseEntry(line, url));
      continue;
    }

    if (!entries.length) header.push(line);
  }

  return { header, entries };
}

export function parseEntry(extinf, url) {
  const attrs = {};
  for (const match of extinf.matchAll(/([\w-]+)="([^"]*)"/g)) {
    attrs[match[1]] = match[2];
  }

  return {
    id: attrs['tvg-id'] || '',
    name: extinf.slice(extinf.lastIndexOf(',') + 1).trim(),
    logo: attrs['tvg-logo'] || '',
    group: attrs['group-title'] || '',
    primaryUrl: url.trim(),
    backupUrls: [],
  };
}

export function formatM3U(header, channels) {
  return [
    ...header,
    ...channels.flatMap((channel) => [formatExtinf(channel), channel.primaryUrl]),
    '',
  ].join('\n');
}

export function formatExtinf(channel) {
  const attrs = [];
  if (channel.id) attrs.push(`tvg-id="${escapeAttr(channel.id)}"`);
  if (channel.logo) attrs.push(`tvg-logo="${escapeAttr(channel.logo)}"`);
  attrs.push(`group-title="${escapeAttr(channel.group)}"`);
  return `#EXTINF:-1 ${attrs.join(' ')},${channel.name}`;
}

export async function readText(filePath) {
  return readFile(filePath, 'utf8');
}

export async function writeText(filePath, text) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, text, 'utf8');
}

export async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readText(filePath));
  } catch (error) {
    if (error.code === 'ENOENT' && fallback !== null) return fallback;
    throw error;
  }
}

export async function writeJson(filePath, data) {
  await writeText(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

export function registryKey(channel) {
  return channel.id || `${channel.name}|${channel.primaryUrl}`;
}

export function uniqueByUrl(channels) {
  const seen = new Set();
  const result = [];
  for (const channel of channels) {
    if (seen.has(channel.primaryUrl)) continue;
    seen.add(channel.primaryUrl);
    result.push(channel);
  }
  return result;
}

export function compilePolicyPatterns(registry) {
  return (registry.rules?.excludedTitlePatterns || []).map((pattern) => ({
    pattern,
    regex: new RegExp(pattern, 'i'),
  }));
}

export function findPolicyViolations(channel, registry) {
  const violations = [];
  const allowedGroups = registry.rules?.allowedGroups || [];
  if (allowedGroups.length && !allowedGroups.includes(channel.group)) {
    violations.push(`group "${channel.group}" is not allowed`);
  }

  const haystack = [
    channel.id,
    channel.name,
    channel.group,
    channel.primaryUrl,
    ...(channel.backupUrls || []),
  ].join(' ');

  for (const { pattern, regex } of compilePolicyPatterns(registry)) {
    if (regex.test(haystack)) violations.push(`matches excluded pattern: ${pattern}`);
  }

  return violations;
}

export function playlistPath(relativePath) {
  return path.join(ROOT_DIR, relativePath);
}

function escapeAttr(value) {
  return String(value).replaceAll('"', '&quot;');
}
