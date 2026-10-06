const TV_USER_AGENT_PATTERN = /\b(Android TV|GoogleTV|SmartTV|BRAVIA|AFT[A-Z0-9]*|TCL|Tizen|webOS|NetCast|Viera|Hisense|MiTV|CrKey)\b/i;
const REMOTE_PLATFORM_PATTERN = /\b(Android|Linux|TV|TCL|Tizen|webOS|NetCast|Viera|Hisense|AFT[A-Z0-9]*|CrKey)\b/i;

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

export function getTvNavigationKey({ key = '', code = '', keyCode = 0 } = {}) {
  if (key === 'ArrowUp' || code === 'ArrowUp' || keyCode === 38 || keyCode === 19) {
    return 'ArrowUp';
  }
  if (key === 'ArrowDown' || code === 'ArrowDown' || keyCode === 40 || keyCode === 20) {
    return 'ArrowDown';
  }
  if (key === 'ArrowLeft' || code === 'ArrowLeft' || keyCode === 37 || keyCode === 21) {
    return 'ArrowLeft';
  }
  if (key === 'ArrowRight' || code === 'ArrowRight' || keyCode === 39 || keyCode === 22) {
    return 'ArrowRight';
  }
  if (
    key === 'Enter'
    || key === 'Select'
    || code === 'Enter'
    || code === 'NumpadEnter'
    || keyCode === 13
    || keyCode === 23
    || keyCode === 66
    || keyCode === 160
  ) {
    return 'Enter';
  }
  if (
    key === 'Escape'
    || key === 'BrowserBack'
    || code === 'Escape'
    || keyCode === 4
    || keyCode === 27
    || keyCode === 461
    || keyCode === 10009
  ) {
    return 'BrowserBack';
  }
  return key;
}

// Native Android key forwarding bypasses WebView's focus-dependent default actions.
export function dispatchNativeTvKey(keyCode, repeatCount, { onKeydown, activeElement }) {
  const key = getTvNavigationKey({ keyCode });
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) return false;
  const target = activeElement();
  if (key === 'Enter' && (target?.tagName === 'SELECT'
    || target?.tagName === 'TEXTAREA'
    || (target?.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit'].includes(target.type)))) {
    return false; // Let the focused WebView open native pickers and the keyboard.
  }
  if (key === 'Enter' && repeatCount > 0) return true;
  let prevented = false;
  onKeydown({ key, keyCode, repeat: repeatCount > 0, target,
    preventDefault() { prevented = true; } });
  if (key === 'Enter' && !prevented) activeElement()?.click?.();
  return true;
}

export function shouldActivateTelevisionFromRemote({
  event = {},
  viewportWidth = 0,
  userAgent = '',
  maxTouchPoints = 0,
} = {}) {
  const navigationKey = getTvNavigationKey(event);
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(navigationKey)) {
    return false;
  }

  const wideScreen = Number(viewportWidth) >= 720;
  if (!wideScreen) return false;
  return REMOTE_PLATFORM_PATTERN.test(userAgent) || Number(maxTouchPoints) === 0;
}

export function getGlobalTvRemoteAction({ key = '', code = '', keyCode = 0 } = {}) {
  if (key === 'ArrowLeft' || code === 'ArrowLeft' || keyCode === 37 || keyCode === 21) return 'left';
  if (
    key === 'ArrowRight'
    || code === 'ArrowRight'
    || keyCode === 39
    || keyCode === 22
  ) return 'right';
  if (key === 'ContextMenu' || code === 'ContextMenu' || keyCode === 93) return 'settings';
  if (key === 'ChannelUp' || code === 'ChannelUp' || keyCode === 166) return 'channel-next';
  if (key === 'ChannelDown' || code === 'ChannelDown' || keyCode === 167) return 'channel-previous';
  if (key === 'MediaPlayPause' || code === 'MediaPlayPause' || keyCode === 179) return 'play-pause';
  if (
    key === 'Escape'
    || key === 'BrowserBack'
    || code === 'Escape'
    || keyCode === 4
    || keyCode === 27
    || keyCode === 461
    || keyCode === 10009
  ) return 'close';
  return null;
}

export function getWrappedFocusIndex(length, currentIndex, direction) {
  if (length <= 0) return -1;
  if (currentIndex < 0 || currentIndex >= length) return direction < 0 ? length - 1 : 0;
  return (currentIndex + direction + length) % length;
}

export function getBoundedFocusIndex(length, currentIndex, direction) {
  if (length <= 0) return -1;
  if (currentIndex < 0 || currentIndex >= length) return direction < 0 ? length - 1 : 0;
  return Math.max(0, Math.min(length - 1, currentIndex + direction));
}

export function getToggledTvPanel(currentPanel, requestedPanel) {
  return currentPanel === requestedPanel ? 'none' : requestedPanel;
}

export function getTvHorizontalPanelAction(currentPanel, direction) {
  if (direction === 'left') {
    if (currentPanel === 'none') return 'channels';
    if (currentPanel === 'settings') return 'settings';
    if (currentPanel === 'channels') return 'categories';
    if (currentPanel === 'categories' || currentPanel === 'browse') return 'settings';
    if (currentPanel === 'favorite') return 'none';
  if (currentPanel === 'countries') return 'settings';
  if (currentPanel === 'preferences') return 'settings';
    if (currentPanel === 'apps') return 'browse';
    return currentPanel;
  }

  if (direction === 'right') {
    if (currentPanel === 'none') return 'channels';
    if (currentPanel === 'settings') return 'browse';
    if (currentPanel === 'categories' || currentPanel === 'browse') return 'channels';
    if (currentPanel === 'apps') return 'none';
    if (currentPanel === 'channels') return 'none';
    return currentPanel;
  }

  return currentPanel;
}

// Back walks out through the left menu hierarchy. Null means the root was reached.
export function getTvBackPanel(currentPanel) {
  if (currentPanel === 'settings') return null;
  if (currentPanel === 'favorite') return 'none';
  if (currentPanel === 'countries') return 'settings';
  if (currentPanel === 'preferences') return 'settings';
  if (currentPanel === 'browse') return 'settings';
  return 'browse';
}

export function getTvVerticalPanelAction(currentPanel, direction) {
  if (direction === 'up') {
    if (currentPanel === 'channels') return 'browse';
  }

  if (direction === 'down') {
    if (currentPanel === 'channel-services') return 'browse';
  }

  return currentPanel;
}
