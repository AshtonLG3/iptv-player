export const QUALITY_OPTIONS = [
  { value: 'auto', label: 'Auto', description: 'Auto (adapts to connection)' },
  { value: 'high', label: 'Highest available', description: 'Highest available (uses more data)' },
  { value: '1080p', label: 'Up to 1080p', description: 'Up to 1080p' },
  { value: '720p', label: 'Up to 720p', description: 'Up to 720p' },
  { value: 'data-saver', label: 'Data saver', description: 'Data saver (up to 480p)' },
];

export function normalizeQuality(value) {
  return QUALITY_OPTIONS.some((option) => option.value === value) ? value : 'auto';
}

export function getQualityHeight(value) {
  return { '1080p': 1080, '720p': 720, 'data-saver': 480 }[value] || Infinity;
}

export function selectQualityLevel(levels, quality) {
  if (!levels?.length || quality === 'auto') return -1;
  const ranked = levels.map((level, index) => ({ ...level, index }))
    .sort((a, b) => (a.height || 0) - (b.height || 0) || (a.bitrate || 0) - (b.bitrate || 0));
  const video = ranked.filter((level) => level.height > 0);
  const candidates = video.length ? video : ranked;
  const eligible = candidates.filter((level) => (level.height || 0) <= getQualityHeight(quality));
  return (eligible[eligible.length - 1] || candidates[0]).index;
}
