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
