const ANDROID_ASSET_HOST = 'appassets.androidplatform.net';

export function resolvePlaylistUrl(playlistUrl, baseUrl) {
  return new URL(playlistUrl, baseUrl).href;
}

export function resolveShareablePlaylistUrl(playlist, baseUrl) {
  const resolvedUrl = resolvePlaylistUrl(playlist.url, baseUrl);
  if (new URL(resolvedUrl).hostname === ANDROID_ASSET_HOST && playlist.publicUrl) {
    return playlist.publicUrl;
  }
  return resolvedUrl;
}

export function createAndroidIntentUrl(playlistUrl, fallbackUrl) {
  const url = new URL(playlistUrl);
  const target = `${url.host}${url.pathname}${url.search}`;
  const fallback = encodeURIComponent(fallbackUrl);
  return `intent://${target}#Intent;scheme=${url.protocol.replace(':', '')};` +
    'action=android.intent.action.VIEW;type=audio/x-mpegurl;' +
    `S.browser_fallback_url=${fallback};end`;
}

export function isAndroidUserAgent(userAgent) {
  return /Android/i.test(userAgent || '');
}
