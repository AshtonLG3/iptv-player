const TECHNICAL_SUFFIX = /\s*\((?:\d{3,4}[pi]|sd|hd|full\s*hd|uhd|4k)\)\s*$/i;
const TRAILING_LANGUAGE = /\s+english\s*$/i;

export function slugifyChannelName(name) {
  const cleanedName = String(name || '')
    .replace(TECHNICAL_SUFFIX, '')
    .replace(TRAILING_LANGUAGE, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[\u2018\u2019']/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return cleanedName || 'channel';
}

function stableChannelKey(channel) {
  return `${channel.tvgId || ''}|${channel.country || ''}|${channel.url || ''}`;
}

export function createChannelRouteIndex(channels) {
  const groupedChannels = new Map();
  const slugByUrl = new Map();
  const channelBySlug = new Map();

  for (const channel of channels) {
    const baseSlug = slugifyChannelName(channel.name);
    const group = groupedChannels.get(baseSlug) || [];
    group.push(channel);
    groupedChannels.set(baseSlug, group);
  }

  for (const [baseSlug, group] of groupedChannels) {
    const sortedGroup = [...group].sort((left, right) => (
      stableChannelKey(left).localeCompare(stableChannelKey(right))
    ));

    sortedGroup.forEach((channel, index) => {
      let slug = baseSlug;
      if (index > 0) {
        const identity = slugifyChannelName(
          channel.country || channel.tvgId?.split('@')[0] || String(index + 1),
        );
        slug = `${baseSlug}-${identity}`;
      }

      let uniqueSlug = slug;
      let collision = 2;
      while (channelBySlug.has(uniqueSlug)) {
        uniqueSlug = `${slug}-${collision}`;
        collision += 1;
      }

      slugByUrl.set(channel.url, uniqueSlug);
      channelBySlug.set(uniqueSlug, channel);
    });
  }

  return { slugByUrl, channelBySlug };
}

export function getPlayerBasePath(pathname) {
  const normalizedPath = String(pathname || '/');
  const tvPathIndex = normalizedPath.indexOf('/tv/');
  if (tvPathIndex !== -1) {
    return normalizedPath.slice(0, tvPathIndex + 4);
  }
  if (normalizedPath.endsWith('/index.html')) {
    return normalizedPath.slice(0, -'index.html'.length);
  }
  return '/';
}

export function getRequestedChannelSlug(pathname, basePath = getPlayerBasePath(pathname)) {
  if (!String(pathname || '').startsWith(basePath)) return '';
  const relativePath = String(pathname || '')
    .slice(basePath.length)
    .replace(/^\/+|\/+$/g, '');
  if (!relativePath || relativePath.includes('/') || relativePath === 'index.html') return '';
  return /^[a-z0-9-]+$/i.test(relativePath) ? relativePath.toLowerCase() : '';
}

export function getChannelPath(basePath, slug) {
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
  return `${normalizedBase}${encodeURIComponent(slug)}/`;
}

export function supportsChannelRoutes({ locationObj, hasAndroidBridge = false }) {
  return !hasAndroidBridge
    && ['http:', 'https:'].includes(locationObj.protocol)
    && locationObj.hostname !== 'appassets.androidplatform.net';
}
