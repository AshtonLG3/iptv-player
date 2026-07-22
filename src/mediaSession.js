export function updateMediaSession({
  mediaSession,
  MediaMetadataCtor,
  nativeBridge = globalThis.AndroidMediaSession,
  channel,
  canNavigate,
  isPlaying = Boolean(channel),
  onPrevious,
  onNext,
}) {
  const browserUpdated = updateBrowserMediaSession({
    mediaSession,
    MediaMetadataCtor,
    channel,
    canNavigate,
    isPlaying,
    onPrevious,
    onNext,
  });
  const nativeUpdated = updateNativeMediaSession({
    nativeBridge,
    channel,
    canNavigate,
    isPlaying,
  });

  return browserUpdated || nativeUpdated;
}

function updateBrowserMediaSession({
  mediaSession,
  MediaMetadataCtor,
  channel,
  canNavigate,
  isPlaying,
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
    mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }

  return true;
}

function updateNativeMediaSession({
  nativeBridge,
  channel,
  canNavigate,
  isPlaying,
}) {
  if (!nativeBridge) return false;

  try {
    if (!channel) {
      nativeBridge.clear?.();
      return typeof nativeBridge.clear === 'function';
    }

    if (typeof nativeBridge.update !== 'function') return false;
    nativeBridge.update(
      channel.name || '',
      'FTA IPTV Player',
      channel.logo || '',
      Boolean(canNavigate),
      Boolean(isPlaying),
    );
    return true;
  } catch {
    return false;
  }
}

function setMediaActionHandler(mediaSession, action, handler) {
  try {
    mediaSession.setActionHandler(action, handler);
  } catch {
    // Some WebView/Chrome versions expose Media Session but not every action.
  }
}
