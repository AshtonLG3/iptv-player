export function getMediaSection(item) {
  if (item.mediaType === 'movie' || item.mediaType === 'show') return item.mediaType;
  const group = String(item.category || '');
  if (/\b(series|shows|episodes)\b/i.test(group)) return 'show';
  if (Number(item.duration) > 0 || /\.(mp4|mkv|webm)(?:[?#]|$)/i.test(item.url || '')) {
    return /\bS\d{1,2}E\d{1,3}\b/i.test(item.name || '') ? 'show' : 'movie';
  }
  return 'live';
}

export function groupChannelVariants(items) {
  const groups = new Map();
  for (const item of items) {
    const name = item.name.replace(/\s*[([]\d{3,4}[pi][)\]]/gi, '').trim();
    const identity = item.tvgId?.split('@')[0] || name.toLowerCase();
    const section = getMediaSection(item);
    const key = JSON.stringify(section === 'live' ? [identity, item.country, section] : [item.url, section]);
    let group = groups.get(key);
    if (!group) {
      group = { ...item, name, variants: [] };
      groups.set(key, group);
    }
    const height = Number(item.name.match(/(\d{3,4})[pi]\b/i)?.[1] || 0);
    for (const url of [item.url, ...(item.backupUrls || [])]) {
      if (!group.variants.some((variant) => variant.url === url)) group.variants.push({ url, height });
    }
  }
  return [...groups.values()];
}

export function getPlaybackSources(channel, quality = 'auto') {
  const variants = channel.variants || [
    { url: channel.url, height: 0 },
    ...(channel.backupUrls || []).map((url) => ({ url, height: 0 })),
  ];
  const ordered = quality === 'data-saver'
    ? [...variants].sort((a, b) => (a.height || Infinity) - (b.height || Infinity))
    : variants;
  return [...new Set(ordered.map((variant) => variant.url))];
}

export function describePlaybackError(error) {
  const message = String(error?.message || '');
  if (error?.name === 'NotAllowedError') return 'Playback needs a tap. Press Play or Retry to start.';
  if (error?.name === 'AbortError') return 'Playback was interrupted. Press Retry to start again.';
  if (/secure page|mixed content/i.test(message)) return 'This stream uses HTTP and is blocked on this secure website. Use the Android app or another channel.';
  if (/timeout|did not start/i.test(message)) return 'The stream took too long to start. Try Data saver, Retry, or another channel.';
  if (/codec|decode|media|native playback/i.test(message)) return 'The stream could not be decoded or has an unsupported format. Try another channel or an external player.';
  if (/manifest|network|load|403|404/i.test(message)) return 'The stream could not be reached. It may be offline, expired, or restricted by its provider. Retry or choose another channel.';
  return 'This stream is unavailable in this player. Retry or choose another channel.';
}
