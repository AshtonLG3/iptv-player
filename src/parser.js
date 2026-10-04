import { FTA_COUNTRIES } from './constants.js?v=20261004a';

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
  let quoted = false;
  let name = '';
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') quoted = !quoted;
    if (line[index] === ',' && !quoted) {
      name = line.slice(index + 1).trim();
      break;
    }
  }
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
      const duration = Number(line.match(/^#EXTINF:([^,\s]+)/)?.[1]);
      if (duration > 0) pending.duration = duration;
      if (['movie', 'show'].includes(attrs['media-type'])) pending.mediaType = attrs['media-type'];
      if (attrs['backup-urls']) {
        try {
          const backups = JSON.parse(decodeURIComponent(attrs['backup-urls']));
          if (Array.isArray(backups)) pending.backupUrls = backups.filter((url) => typeof url === 'string' && /^https?:\/\//i.test(url));
        } catch {
          // A malformed optional backup attribute must not break a playlist.
        }
      }
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

export function filterByFtaCountries(channels) {
  return channels.filter((channel) => channel.country && FTA_COUNTRIES[channel.country]);
}
