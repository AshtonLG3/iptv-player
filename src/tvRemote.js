const TV_USER_AGENT_PATTERN = /\b(Android TV|GoogleTV|SmartTV|BRAVIA|AFT[A-Z0-9]*|TCL[^;)]*TV)\b/i;

export function detectTelevision({ bridge = null, userAgent = '' } = {}) {
  try {
    if (bridge && typeof bridge.isTelevision === 'function' && bridge.isTelevision()) {
      return true;
    }
  } catch {
    // Fall back to the user agent when a vendor WebView bridge is unavailable.
  }

  return TV_USER_AGENT_PATTERN.test(userAgent);
}

export function getGlobalTvRemoteAction({ key = '', code = '', keyCode = 0 } = {}) {
  if (key === 'ArrowLeft' || code === 'ArrowLeft' || keyCode === 37) return 'left';
  if (
    key === 'ArrowRight'
    || code === 'ArrowRight'
    || keyCode === 39
  ) return 'right';
  if (key === 'ContextMenu' || code === 'ContextMenu' || keyCode === 93) return 'settings';
  if (key === 'ChannelUp' || code === 'ChannelUp' || keyCode === 166) return 'channel-next';
  if (key === 'ChannelDown' || code === 'ChannelDown' || keyCode === 167) return 'channel-previous';
  if (key === 'MediaPlayPause' || code === 'MediaPlayPause' || keyCode === 179) return 'play-pause';
  if (key === 'Escape' || key === 'BrowserBack' || code === 'Escape' || keyCode === 27) return 'close';
  return null;
}

export function getWrappedFocusIndex(length, currentIndex, direction) {
  if (length <= 0) return -1;
  if (currentIndex < 0 || currentIndex >= length) return direction < 0 ? length - 1 : 0;
  return (currentIndex + direction + length) % length;
}

export function getToggledTvPanel(currentPanel, requestedPanel) {
  return currentPanel === requestedPanel ? 'none' : requestedPanel;
}

export function getTvHorizontalPanelAction(currentPanel, direction) {
  if (direction === 'left') {
    if (currentPanel === 'none') return 'channels';
    if (currentPanel === 'settings') return 'none';
    return currentPanel;
  }

  if (direction === 'right') {
    if (currentPanel === 'none') return 'settings';
    if (currentPanel === 'channels') return 'none';
    return currentPanel;
  }

  return currentPanel;
}
