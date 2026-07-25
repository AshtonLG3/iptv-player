import { loadChannels } from './src/playlist.js';
import { COMPATIBLE_PLAYERS, CURATED_PLAYLISTS, OFFICIAL_SERVICES } from './src/constants.js';
import {
  createAndroidIntentUrl,
  isAndroidUserAgent,
  resolveShareablePlaylistUrl,
} from './src/playlistAccess.js';
import { renderApp } from './src/ui.js';
import { createPlayer } from './src/player.js';
import { updateMediaSession } from './src/mediaSession.js';
import {
  detectTelevision,
  getGlobalTvRemoteAction,
  getToggledTvPanel,
} from './src/tvRemote.js';
import {
  getTheme,
  isFavorite,
  setTheme,
  toggleFavorite,
  getLastWatched,
  setLastWatched,
} from './src/storage.js';

async function main() {
  const root = document.getElementById('app');
  const videoEl = document.getElementById('video');
  const statusEl = document.getElementById('player-status');
  const retryButton = document.getElementById('retry-button');
  const previousChannelButton = document.getElementById('previous-channel-button');
  const nextChannelButton = document.getElementById('next-channel-button');
  const layoutEl = document.querySelector('.layout');
  const playerPanelEl = document.querySelector('.player-panel');
  const drawerHandle = document.getElementById('drawer-handle');
  const landscapeDrawerQuery = window.matchMedia('(orientation: landscape) and (max-height: 540px)');
  const officialServiceById = Object.fromEntries(OFFICIAL_SERVICES.map((service) => [service.id, service]));
  const vlcAndroid = COMPATIBLE_PLAYERS.find((playerLink) => playerLink.id === 'vlc-android');
  const CHANNEL_NAV_AUTO_HIDE_MS = 2600;
  let touchStartX = 0;
  let touchStartY = 0;
  let channelNavHideTimer = null;
  let channelTuneTimer = null;
  let appView = null;
  let currentChannel = null;
  let visibleChannels = [];
  let tvPanel = 'none';
  let syncingTvPanel = false;
  const androidDeviceBridge = globalThis.AndroidDevice;
  const isTvMode = detectTelevision({
    bridge: androidDeviceBridge,
    userAgent: navigator.userAgent,
  });

  document.documentElement.classList.toggle('tv-mode', isTvMode);
  if (isTvMode) {
    videoEl.removeAttribute('controls');
    videoEl.controls = false;
    videoEl.disablePictureInPicture = true;
    videoEl.tabIndex = -1;
    playerPanelEl.tabIndex = -1;
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
  }

  const favoritesApi = {
    isFavorite: (url) => isFavorite(window.localStorage, url),
    toggle: (url) => toggleFavorite(window.localStorage, url),
  };

  const themeApi = {
    get: () => getTheme(window.localStorage),
    set: (theme) => {
      const nextTheme = setTheme(window.localStorage, theme);
      applyTheme(nextTheme);
      return nextTheme;
    },
  };

  const playlistAccessApi = {
    playlists: CURATED_PLAYLISTS,
    compatiblePlayers: COMPATIBLE_PLAYERS,
    resolveUrl: (playlist) => resolveShareablePlaylistUrl(playlist, window.location.href),
    canShare: () => Boolean(navigator.share),
    canOpenInApp: () => isAndroidUserAgent(navigator.userAgent),
    copyUrl: copyText,
    sharePlaylist: ({ name, url }) => navigator.share({
      title: name,
      text: `${name} playlist`,
      url,
    }),
    openInApp: (url) => {
      window.location.href = createAndroidIntentUrl(url, vlcAndroid.url);
    },
  };

  applyTheme(themeApi.get());

  function setDrawerOpen(isOpen) {
    layoutEl.classList.toggle('drawer-open', isOpen);
    drawerHandle.setAttribute('aria-expanded', String(isOpen));
    drawerHandle.setAttribute('aria-label', isOpen ? 'Hide channels' : 'Show channels');
    if (isOpen) setChannelNavVisible(false);
  }

  function isLandscapeDrawerActive() {
    return isTvMode || landscapeDrawerQuery.matches;
  }

  function notifyNativeTvPanelState() {
    try {
      androidDeviceBridge?.setPanelOpen?.(tvPanel !== 'none');
    } catch {
      // The browser build has no native Android TV state bridge.
    }
  }

  function setTvPanel(panel, { focus = true } = {}) {
    if (!isTvMode) return;

    const nextPanel = panel === 'channels' || panel === 'settings' ? panel : 'none';
    tvPanel = nextPanel;
    syncingTvPanel = true;
    setDrawerOpen(nextPanel === 'channels');
    appView?.setMenuOpen(nextPanel === 'settings');
    syncingTvPanel = false;
    notifyNativeTvPanelState();

    if (!focus) return;
    window.requestAnimationFrame(() => {
      if (nextPanel === 'channels') appView?.focusChannel(currentChannel?.url);
      if (nextPanel === 'settings') appView?.focusMenu();
      if (nextPanel === 'none') playerPanelEl.focus({ preventScroll: true });
    });
  }

  function toggleTvPanel(panel) {
    setTvPanel(getToggledTvPanel(tvPanel, panel));
  }

  drawerHandle.addEventListener('click', () => {
    if (isTvMode) {
      toggleTvPanel('channels');
      return;
    }
    if (isLandscapeDrawerActive()) {
      setDrawerOpen(!layoutEl.classList.contains('drawer-open'));
    }
  });

  layoutEl.addEventListener('touchstart', (event) => {
    if (!isLandscapeDrawerActive() || event.touches.length !== 1) return;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
  }, { passive: true });

  layoutEl.addEventListener('touchend', (event) => {
    if (!isLandscapeDrawerActive() || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = Math.abs(touch.clientY - touchStartY);
    const drawerIsOpen = layoutEl.classList.contains('drawer-open');

    if (!drawerIsOpen && touchStartX < 36 && dx > 70 && dy < 60) {
      setDrawerOpen(true);
    } else if (drawerIsOpen && dx < -70 && dy < 60) {
      setDrawerOpen(false);
    }
  }, { passive: true });

  landscapeDrawerQuery.addEventListener('change', () => {
    if (isTvMode) return;
    setDrawerOpen(false);
    setChannelNavVisible(false);
  });

  const player = createPlayer(videoEl);
  player.onError((err) => {
    renderPlayerError(err);
    statusEl.hidden = false;
  });

  function getOfficialFallback(channel) {
    if (!channel) return null;
    const name = channel.name.toLowerCase();
    if (name.includes('sabc sport')) return officialServiceById['sabc-sport'];
    if (name.includes('sabc')) return officialServiceById['sabc-plus'];
    if (name.includes('zbc')) return officialServiceById.zplus;
    if (name.includes('e.tv') || name.includes('etv') || name.includes('evod') || name.includes('emovies') || name.includes('eextra')) {
      return officialServiceById.evod;
    }
    return null;
  }

  function renderPlayerError(err) {
    statusEl.textContent = '';
    statusEl.append(document.createTextNode(`Can't play this channel: ${err.message}`));

    const fallback = getOfficialFallback(currentChannel);
    if (!fallback) return;

    const link = document.createElement('a');
    link.href = fallback.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = `Open ${fallback.name}`;
    statusEl.append(document.createTextNode('  '));
    statusEl.appendChild(link);
  }

  function selectChannel(channel) {
    currentChannel = channel;
    statusEl.hidden = true;
    setLastWatched(window.localStorage, channel.url);
    appView?.setNowPlaying(channel.url);
    updateChannelNavButtons();
    if (isTvMode) {
      setTvPanel('none');
    } else if (isLandscapeDrawerActive()) {
      setDrawerOpen(false);
    }

    clearTimeout(channelTuneTimer);
    const startPlayback = () => {
      player.play([channel.url, ...(channel.backupUrls || [])]);
      syncMediaSession(true);
    };
    if (isTvMode) {
      channelTuneTimer = window.setTimeout(startPlayback, 180);
    } else {
      startPlayback();
    }
  }

  function setVisibleChannels(channels) {
    visibleChannels = channels;
    updateChannelNavButtons();
    syncMediaSession();
  }

  function navigateChannel(direction) {
    if (!visibleChannels.length) return;

    const currentIndex = currentChannel
      ? visibleChannels.findIndex((channel) => channel.url === currentChannel.url)
      : -1;
    const nextIndex = currentIndex === -1
      ? (direction > 0 ? 0 : visibleChannels.length - 1)
      : (currentIndex + direction + visibleChannels.length) % visibleChannels.length;

    selectChannel(visibleChannels[nextIndex]);
  }

  function updateChannelNavButtons() {
    const disabled = visibleChannels.length < 2;
    previousChannelButton.disabled = disabled;
    nextChannelButton.disabled = disabled;
    if (disabled) setChannelNavVisible(false);
  }

  function setChannelNavVisible(isVisible) {
    clearTimeout(channelNavHideTimer);
    channelNavHideTimer = null;
    layoutEl.classList.toggle(
      'channel-nav-visible',
      isVisible && !isTvMode && isLandscapeDrawerActive() && visibleChannels.length > 1,
    );
  }

  function showChannelNavTemporarily() {
    if (isTvMode || !isLandscapeDrawerActive() || visibleChannels.length < 2) return;

    setChannelNavVisible(true);
    channelNavHideTimer = window.setTimeout(() => {
      setChannelNavVisible(false);
    }, CHANNEL_NAV_AUTO_HIDE_MS);
  }

  function isPlaybackActive(forcePlaying = false) {
    return Boolean(currentChannel) && (forcePlaying || (!videoEl.paused && !videoEl.ended));
  }

  function syncMediaSession(forcePlaying = false) {
    updateMediaSession({
      mediaSession: navigator.mediaSession,
      MediaMetadataCtor: window.MediaMetadata,
      channel: currentChannel,
      canNavigate: visibleChannels.length > 1,
      isPlaying: isPlaybackActive(forcePlaying),
      onPrevious: () => navigateChannel(-1),
      onNext: () => navigateChannel(1),
    });
  }

  function playCurrentVideo() {
    void videoEl.play();
    syncMediaSession(true);
  }

  function pauseCurrentVideo() {
    videoEl.pause();
    syncMediaSession(false);
  }

  function toggleCurrentVideo() {
    if (videoEl.paused) {
      playCurrentVideo();
      return;
    }
    pauseCurrentVideo();
  }

  function handleTvRemoteAction(action) {
    switch (action) {
      case 'channels':
        toggleTvPanel('channels');
        return true;
      case 'settings':
        toggleTvPanel('settings');
        return true;
      case 'channel-next':
        navigateChannel(1);
        return true;
      case 'channel-previous':
        navigateChannel(-1);
        return true;
      case 'play-pause':
        if (currentChannel) toggleCurrentVideo();
        return true;
      case 'close':
        if (tvPanel === 'none') return false;
        setTvPanel('none');
        return true;
      default:
        return false;
    }
  }

  function handleTvKeydown(event) {
    if (!isTvMode) return;

    const action = getGlobalTvRemoteAction(event);
    if (action && handleTvRemoteAction(action)) {
      event.preventDefault();
      return;
    }

    const direction = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (direction && tvPanel === 'channels' && appView?.moveChannelFocus(direction)) {
      event.preventDefault();
      return;
    }
    if (direction && tvPanel === 'settings' && appView?.moveMenuFocus(direction)) {
      event.preventDefault();
      return;
    }

    if ((event.key === 'Enter' || event.key === ' ') && tvPanel === 'none') {
      event.preventDefault();
      if (currentChannel) toggleCurrentVideo();
      else setTvPanel('channels');
    }
  }

  async function boot() {
    retryButton.hidden = true;
    root.textContent = 'Loading FTA channels...';

    try {
      const channels = await loadChannels({
        fetchImpl: window.fetch.bind(window),
        sessionStore: window.sessionStorage,
      });

      appView = renderApp({
        root,
        channels,
        favoritesApi,
        themeApi,
        playlistAccessApi,
        onSelectChannel: selectChannel,
        onVisibleChannelsChange: setVisibleChannels,
        onMenuOpenChange: (isOpen) => {
          if (!isTvMode || syncingTvPanel) return;
          if (isOpen && tvPanel !== 'settings') setTvPanel('settings');
          if (!isOpen && tvPanel === 'settings') setTvPanel('none');
        },
      });

      if (isTvMode) setTvPanel('none');

      const lastWatchedUrl = getLastWatched(window.localStorage);
      const lastChannel = channels.find((c) => c.url === lastWatchedUrl);
      if (lastChannel) {
        selectChannel(lastChannel);
      } else if (isTvMode) {
        setTvPanel('channels');
      }
    } catch (err) {
      root.textContent = `Failed to load channel list: ${err.message}`;
      retryButton.hidden = false;
    }
  }

  retryButton.addEventListener('click', boot);
  playerPanelEl.addEventListener('touchstart', showChannelNavTemporarily, { passive: true });
  playerPanelEl.addEventListener('mousemove', showChannelNavTemporarily);
  playerPanelEl.addEventListener('click', showChannelNavTemporarily);
  previousChannelButton.addEventListener('click', () => navigateChannel(-1));
  nextChannelButton.addEventListener('click', () => navigateChannel(1));
  videoEl.addEventListener('playing', () => syncMediaSession(true));
  videoEl.addEventListener('play', () => syncMediaSession(true));
  videoEl.addEventListener('pause', () => syncMediaSession(false));
  videoEl.addEventListener('ended', () => syncMediaSession(false));
  document.addEventListener('keydown', handleTvKeydown);
  window.__ftaIptvPreviousChannel = () => navigateChannel(-1);
  window.__ftaIptvNextChannel = () => navigateChannel(1);
  window.__ftaIptvPlay = playCurrentVideo;
  window.__ftaIptvPause = pauseCurrentVideo;
  window.__ftaIptvTogglePlayback = toggleCurrentVideo;
  window.__ftaIptvTvToggleChannels = () => toggleTvPanel('channels');
  window.__ftaIptvTvToggleMenu = () => toggleTvPanel('settings');
  window.__ftaIptvTvClosePanel = () => handleTvRemoteAction('close');
  window.addEventListener('pagehide', () => {
    clearTimeout(channelTuneTimer);
    clearTimeout(channelNavHideTimer);
    player.destroy();
  }, { once: true });
  boot();
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  textArea.remove();
}

main();
