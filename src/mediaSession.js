export function updateMediaSession({
  mediaSession,
  MediaMetadataCtor,
  channel,
  canNavigate,
  onPrevious,
  onNext,
}) {
  if (!mediaSession) return false;

  if (channel && typeof MediaMetadataCtor === 'function') {
    const artwork = channel.logo
      ? [{ src: channel.logo, sizes: '512x512', type: 'image/png' }]
      : [];

    mediaSession.metadata = new MediaMetadataCtor({
      title: channel.name,
      artist: 'FTA IPTV Player',
      artwork,
    });
  }

  if (typeof mediaSession.setActionHandler === 'function') {
    setMediaActionHandler(mediaSession, 'previoustrack', canNavigate ? onPrevious : null);
    setMediaActionHandler(mediaSession, 'nexttrack', canNavigate ? onNext : null);
  }

  if ('playbackState' in mediaSession && channel) {
    mediaSession.playbackState = 'playing';
  }

  return true;
}

function setMediaActionHandler(mediaSession, action, handler) {
  try {
    mediaSession.setActionHandler(action, handler);
  } catch {
    // Some WebView/Chrome versions expose Media Session but not every action.
  }
}
