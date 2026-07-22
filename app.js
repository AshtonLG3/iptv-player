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
    return landscapeDrawerQuery.matches;
  }

  drawerHandle.addEventListener('click', () => {
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
    setDrawerOpen(false);
    setChannelNavVisible(false);
  });

  let appView = null;
  let currentChannel = null;
  let visibleChannels = [];
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
    syncMediaSession();
    if (isLandscapeDrawerActive()) {
      setDrawerOpen(false);
    }
    player.play([channel.url, ...(channel.backupUrls || [])]);
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
      isVisible && isLandscapeDrawerActive() && visibleChannels.length > 1,
    );
  }

  function showChannelNavTemporarily() {
    if (!isLandscapeDrawerActive() || visibleChannels.length < 2) return;

    setChannelNavVisible(true);
    channelNavHideTimer = window.setTimeout(() => {
      setChannelNavVisible(false);
    }, CHANNEL_NAV_AUTO_HIDE_MS);
  }

  function syncMediaSession() {
    updateMediaSession({
      mediaSession: navigator.mediaSession,
      MediaMetadataCtor: window.MediaMetadata,
      channel: currentChannel,
      canNavigate: visibleChannels.length > 1,
      onPrevious: () => navigateChannel(-1),
      onNext: () => navigateChannel(1),
    });
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
      });

      const lastWatchedUrl = getLastWatched(window.localStorage);
      const lastChannel = channels.find((c) => c.url === lastWatchedUrl);
      if (lastChannel) {
        selectChannel(lastChannel);
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
