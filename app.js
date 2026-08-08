import * as playlistModule from './src/playlist.js?v=20260808d';
import {
  COMPATIBLE_PLAYERS,
  CURATED_PLAYLISTS,
  FEATURED_OFFICIAL_SERVICE_IDS,
  OFFICIAL_SERVICES,
} from './src/constants.js?v=20260808d';
import {
  createAndroidIntentUrl,
  isAndroidUserAgent,
  resolveShareablePlaylistUrl,
} from './src/playlistAccess.js?v=20260808d';
import {
  getCategoryNames,
  getChannelInitials,
  renderApp,
  resolveChannelLogoUrl,
} from './src/ui.js?v=20260808d';
import { createPlayer } from './src/player.js?v=20260808d';
import { createFullscreenController } from './src/fullscreen.js?v=20260808d';
import {
  createChannelRouteIndex,
  getChannelPath,
  getPlayerBasePath,
  getRequestedChannelSlug,
  supportsChannelRoutes,
} from './src/channelRoute.js?v=20260808d';
import { updateMediaSession } from './src/mediaSession.js?v=20260808d';
import {
  detectTelevision,
  getGlobalTvRemoteAction,
  getTvNavigationKey,
  getToggledTvPanel,
  getTvHorizontalPanelAction,
  getTvVerticalPanelAction,
  getWrappedFocusIndex,
  shouldActivateTelevisionFromRemote,
} from './src/tvRemote.js?v=20260808d';
import {
  getTheme,
  isFavorite,
  setTheme,
  toggleFavorite,
  getLastWatched,
  setLastWatched,
} from './src/storage.js?v=20260808d';

const {
  clearPrivatePlaylist,
  getPrivatePlaylist,
  loadChannels,
  savePrivatePlaylist,
} = playlistModule;

async function main() {
  const root = document.getElementById('app');
  const videoEl = document.getElementById('video');
  const statusEl = document.getElementById('player-status');
  const retryButton = document.getElementById('retry-button');
  const previousChannelButton = document.getElementById('previous-channel-button');
  const playPauseButton = document.getElementById('play-pause-button');
  const nextChannelButton = document.getElementById('next-channel-button');
  const layoutEl = document.querySelector('.layout');
  const playerPanelEl = document.querySelector('.player-panel');
  const playerFrameEl = document.querySelector('.player-frame');
  const playerPlaceholderEl = document.getElementById('player-placeholder');
  const playerPlaceholderLabel = document.getElementById('player-placeholder-label');
  const websiteLink = document.getElementById('website-link');
  const fullscreenToggle = document.getElementById('fullscreen-toggle');
  const featuredServiceList = document.getElementById('featured-service-list');
  const drawerHandle = document.getElementById('drawer-handle');
  const nowPlayingSummary = document.getElementById('now-playing-summary');
  const nowPlayingLogo = document.getElementById('now-playing-logo');
  const nowPlayingFallback = document.getElementById('now-playing-fallback');
  const nowPlayingState = document.getElementById('now-playing-state');
  const nowPlayingTitle = document.getElementById('now-playing-title');
  const nowPlayingCategory = document.getElementById('now-playing-category');
  const nowPlayingFavorite = document.getElementById('now-playing-favorite');
  const settingsToggle = document.getElementById('settings-toggle');
  const playerOrientationToggle = document.getElementById('player-orientation-toggle');
  const playerHud = document.getElementById('player-hud');
  const playerHudLogo = document.getElementById('player-hud-logo');
  const playerHudFallback = document.getElementById('player-hud-fallback');
  const playerHudTitle = document.getElementById('player-hud-title');
  const playerHudMeta = document.getElementById('player-hud-meta');
  const landscapeDrawerQuery = window.matchMedia('(orientation: landscape) and (max-height: 540px)');
  const officialServiceById = Object.fromEntries(OFFICIAL_SERVICES.map((service) => [service.id, service]));
  const vlcAndroid = COMPATIBLE_PLAYERS.find((playerLink) => playerLink.id === 'vlc-android');
  const CHANNEL_NAV_AUTO_HIDE_MS = 2600;
  let touchStartX = 0;
  let touchStartY = 0;
  let channelDrawerGestureStarted = false;
  let channelNavHideTimer = null;
  let channelTuneTimer = null;
  let playerPlaceholderTimer = null;
  let currentChannelHasPlayed = false;
  let playerHudHideTimer = null;
  let appView = null;
  let currentChannel = null;
  let visibleChannels = [];
  let channelRoutes = createChannelRouteIndex([]);
  let tvPanel = 'none';
  let syncingTvPanel = false;
  const androidDeviceBridge = globalThis.AndroidDevice;
  let isTvMode = detectTelevision({
    bridge: androidDeviceBridge,
    userAgent: navigator.userAgent,
  });
  const channelRouteBase = getPlayerBasePath(window.location.pathname);
  const channelRoutingEnabled = supportsChannelRoutes({
    locationObj: window.location,
    hasAndroidBridge: Boolean(androidDeviceBridge),
  });

  document.documentElement.classList.toggle('tv-mode', isTvMode);
  document.documentElement.classList.toggle('android-app', Boolean(androidDeviceBridge));

  function activateTelevisionMode() {
    if (isTvMode) return;
    isTvMode = true;
    tvPanel = 'none';
    document.documentElement.classList.add('tv-mode');
    fullscreenToggle.hidden = true;
  }

  function openWithAndroidExternalApp(event) {
    suspendCurrentVideo();
    if (typeof androidDeviceBridge?.openOfficialUrl !== 'function') return;
    event.preventDefault();
    androidDeviceBridge.openOfficialUrl(event.currentTarget.href);
  }

  function renderFeaturedServices(container, { focusable = true } = {}) {
    if (!container) return;
    container.replaceChildren();
    for (const serviceId of FEATURED_OFFICIAL_SERVICE_IDS) {
      const service = officialServiceById[serviceId];
      if (!service) continue;
      if (service.androidOnly && !androidDeviceBridge) continue;
      const link = document.createElement('a');
      link.href = service.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.className = 'featured-service-link';
      link.setAttribute('aria-label', `Open ${service.name}`);
      link.title = `${service.name} - ${service.note}`;
      if (!focusable) link.tabIndex = -1;

      if (service.logo) {
        const logo = document.createElement('img');
        logo.src = service.logo;
        logo.alt = '';
        logo.className = 'featured-service-logo';
        logo.loading = 'eager';
        logo.decoding = 'async';
        logo.addEventListener('error', () => logo.remove(), { once: true });
        link.appendChild(logo);
      } else {
        link.classList.add('text-only');
      }

      const label = document.createElement('span');
      label.className = 'featured-service-label';
      label.textContent = service.shortLabel || service.name;

      link.appendChild(label);
      link.addEventListener('click', (event) => {
        if (
          service.androidPackage
          && typeof androidDeviceBridge?.openOfficialApp === 'function'
        ) {
          event.preventDefault();
          suspendCurrentVideo();
          androidDeviceBridge.openOfficialApp(
            service.androidPackage,
            service.url,
            service.androidDeepLink || '',
          );
          return;
        }
        openWithAndroidExternalApp(event);
      });
      container.appendChild(link);
    }
  }
  renderFeaturedServices(featuredServiceList);
  websiteLink.addEventListener('click', openWithAndroidExternalApp);

  const fullscreenController = createFullscreenController({
    documentObj: document,
    playerElement: playerFrameEl,
    videoElement: videoEl,
  });

  function updateFullscreenControl() {
    const active = fullscreenController.isActive();
    fullscreenToggle.setAttribute('aria-label', active ? 'Exit full screen' : 'Enter full screen');
    fullscreenToggle.setAttribute('aria-pressed', String(active));
    fullscreenToggle.title = active ? 'Exit full screen' : 'Full screen';
    playerFrameEl.classList.toggle('is-fullscreen', active);
  }

  fullscreenToggle.hidden = isTvMode
    || Boolean(androidDeviceBridge)
    || !fullscreenController.isSupported();
  fullscreenToggle.addEventListener('click', async () => {
    try {
      await fullscreenController.toggle();
      updateFullscreenControl();
    } catch {
      statusEl.textContent = 'Full screen is not available in this browser.';
      statusEl.hidden = false;
    }
  });
  document.addEventListener('fullscreenchange', updateFullscreenControl);
  document.addEventListener('webkitfullscreenchange', updateFullscreenControl);
  updateFullscreenControl();

  videoEl.removeAttribute('controls');
  videoEl.controls = false;
  videoEl.disablePictureInPicture = true;
  videoEl.tabIndex = -1;
  if (isTvMode) {
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

  function readLocalPlaylistFile(file) {
    if (typeof file?.text === 'function') return file.text();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(String(reader.result || '')));
      reader.addEventListener('error', () => reject(new Error('The selected file could not be read.')));
      reader.readAsText(file);
    });
  }

  const privatePlaylistApi = androidDeviceBridge ? {
    getInfo: () => {
      const playlist = getPrivatePlaylist(window.localStorage);
      return playlist ? { name: playlist.name, channelCount: playlist.channels.length } : null;
    },
    importFile: async (file) => savePrivatePlaylist(window.localStorage, {
      name: file?.name,
      text: await readLocalPlaylistFile(file),
    }),
    clear: () => clearPrivatePlaylist(window.localStorage),
    reload: () => window.location.reload(),
  } : null;

  const playlistAccessApi = {
    playlists: CURATED_PLAYLISTS,
    compatiblePlayers: COMPATIBLE_PLAYERS,
    privatePlaylist: privatePlaylistApi,
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
      if (typeof androidDeviceBridge?.setPanel === 'function') {
        androidDeviceBridge.setPanel(tvPanel);
      } else {
        androidDeviceBridge?.setPanelOpen?.(tvPanel !== 'none');
      }
    } catch {
      // The browser build has no native Android TV state bridge.
    }
  }

  function setTvPanel(panel, { focus = true } = {}) {
    if (!isTvMode) return;

    const nextPanel = [
      'channels',
      'categories',
      'channel-services',
      'settings',
      'playback',
      'services',
    ].includes(panel)
      ? panel
      : 'none';
    tvPanel = nextPanel;
    syncingTvPanel = true;
    setDrawerOpen([
      'channels',
      'categories',
      'channel-services',
    ].includes(nextPanel));
    appView?.setMenuOpen(nextPanel === 'settings');
    if (nextPanel === 'playback' || nextPanel === 'services') setChannelNavVisible(true);
    if (nextPanel === 'none') setChannelNavVisible(false);
    syncingTvPanel = false;
    notifyNativeTvPanelState();

    if (!focus) return;
    window.requestAnimationFrame(() => {
      if (nextPanel === 'channels') appView?.focusChannel();
      if (nextPanel === 'categories') appView?.focusCategory();
      if (nextPanel === 'channel-services') appView?.focusChannelService();
      if (nextPanel === 'settings') appView?.focusMenu();
      if (nextPanel === 'playback') focusPlayerControl();
      if (nextPanel === 'services') focusFeaturedService();
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
    if (event.touches.length !== 1) return;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
    const playerBounds = playerFrameEl.getBoundingClientRect();
    const touchIsInsidePlayer = touchStartX >= playerBounds.left
      && touchStartX <= playerBounds.right
      && touchStartY >= playerBounds.top
      && touchStartY <= playerBounds.bottom;
    if (touchIsInsidePlayer) showChannelNavTemporarily();
    if (!isLandscapeDrawerActive()) return;
    if (!isTvMode) {
      const videoBounds = videoEl.getBoundingClientRect();
      const swipeZoneWidth = Math.min(Math.max(videoBounds.width * 0.28, 96), 260);
      channelDrawerGestureStarted = !layoutEl.classList.contains('drawer-open')
        && !layoutEl.classList.contains('settings-open')
        && touchStartX >= videoBounds.right - swipeZoneWidth
        && touchStartX <= videoBounds.right
        && touchStartY >= videoBounds.top
        && touchStartY <= videoBounds.bottom;
    }
  }, { capture: true, passive: true });

  layoutEl.addEventListener('touchend', (event) => {
    if (!isLandscapeDrawerActive() || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = Math.abs(touch.clientY - touchStartY);
    const drawerIsOpen = layoutEl.classList.contains('drawer-open');

    if (!drawerIsOpen && !isTvMode && channelDrawerGestureStarted && dx < -70 && dy < 60) {
      setDrawerOpen(true);
    } else if (!drawerIsOpen && isTvMode && touchStartX < 36 && dx > 70 && dy < 60) {
      setDrawerOpen(true);
    } else if (drawerIsOpen && !isTvMode && dx > 70 && dy < 60) {
      setDrawerOpen(false);
    } else if (drawerIsOpen && isTvMode && dx < -70 && dy < 60) {
      setDrawerOpen(false);
    }
    channelDrawerGestureStarted = false;
  }, { capture: true, passive: true });

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

  function showPlayerPlaceholder(label) {
    clearTimeout(playerPlaceholderTimer);
    playerPlaceholderLabel.textContent = label;
    playerPlaceholderEl.hidden = false;
  }

  function hidePlayerPlaceholder() {
    clearTimeout(playerPlaceholderTimer);
    playerPlaceholderEl.hidden = true;
  }

  function scheduleWaitingPlaceholder() {
    if (!currentChannel || !playerPlaceholderEl.hidden || currentChannelHasPlayed) return;
    clearTimeout(playerPlaceholderTimer);
    playerPlaceholderTimer = window.setTimeout(() => {
      showPlayerPlaceholder('Loading channel…');
    }, 250);
  }

  function markCurrentChannelMediaReady() {
    if (!currentChannel) return;
    currentChannelHasPlayed = true;
    hidePlayerPlaceholder();
  }

  videoEl.addEventListener('loadeddata', markCurrentChannelMediaReady);
  videoEl.addEventListener('canplay', markCurrentChannelMediaReady);
  videoEl.addEventListener('playing', markCurrentChannelMediaReady);
  videoEl.addEventListener('timeupdate', () => {
    if (!videoEl.paused && videoEl.currentTime > 0) markCurrentChannelMediaReady();
  });
  videoEl.addEventListener('waiting', scheduleWaitingPlaceholder);
  videoEl.addEventListener('stalled', scheduleWaitingPlaceholder);
  videoEl.addEventListener('ended', () => showPlayerPlaceholder('Channel ended'));

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
    updatePlaybackLabel('Unavailable');
    showPlayerPlaceholder('Channel unavailable');
    statusEl.textContent = '';
    statusEl.append(document.createTextNode(`Can't play this channel: ${err.message}`));

    const fallback = getOfficialFallback(currentChannel);
    if (!fallback) return;

    const link = document.createElement('a');
    link.href = fallback.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.dataset.inAppBrowser = 'true';
    link.textContent = `Open ${fallback.name}`;
    statusEl.append(document.createTextNode('  '));
    statusEl.appendChild(link);
  }

  function getChannelCategory(channel) {
    return getCategoryNames(channel?.category)[0] || 'Live TV';
  }

  function updateArtwork(image, fallback, channel) {
    fallback.textContent = getChannelInitials(channel?.name);
    fallback.hidden = Boolean(channel?.logo);
    image.hidden = !channel?.logo;
    image.onload = () => {
      image.hidden = false;
      fallback.hidden = true;
    };
    image.onerror = () => {
      image.hidden = true;
      fallback.hidden = false;
    };
    image.src = resolveChannelLogoUrl(channel?.logo);
  }

  function updateNowPlayingSummary(channel) {
    if (!channel) {
      nowPlayingSummary.hidden = true;
      return;
    }
    nowPlayingSummary.hidden = false;
    nowPlayingTitle.textContent = channel.name;
    nowPlayingCategory.textContent = getChannelCategory(channel);
    updateArtwork(nowPlayingLogo, nowPlayingFallback, channel);
    const favorite = favoritesApi.isFavorite(channel.url);
    nowPlayingFavorite.textContent = favorite ? '★' : '☆';
    nowPlayingFavorite.classList.toggle('selected', favorite);
    nowPlayingFavorite.setAttribute(
      'aria-label',
      `${favorite ? 'Remove' : 'Add'} ${channel.name} ${favorite ? 'from' : 'to'} favorites`,
    );
  }

  function updatePlaybackLabel(label) {
    nowPlayingState.textContent = label;
  }

  function showPlayerHud(channel) {
    if (!isTvMode || !channel) return;
    clearTimeout(playerHudHideTimer);
    updateArtwork(playerHudLogo, playerHudFallback, channel);
    playerHudTitle.textContent = channel.name;
    playerHudMeta.textContent = `${getChannelCategory(channel)} · Live`;
    playerHud.hidden = false;
    window.requestAnimationFrame(() => playerHud.classList.add('visible'));
    playerHudHideTimer = window.setTimeout(() => {
      playerHud.classList.remove('visible');
      window.setTimeout(() => {
        if (!playerHud.classList.contains('visible')) playerHud.hidden = true;
      }, 180);
    }, 3200);
  }

  function syncChannelRoute(channel, historyMode) {
    if (!channelRoutingEnabled) return;
    const slug = channelRoutes.slugByUrl.get(channel.url);
    if (!slug) return;
    document.title = `${channel.name.replace(/\s*\(\d{3,4}[pi]\)\s*$/i, '')} - Rugare TV`;
    if (historyMode === 'none') return;
    const channelPath = getChannelPath(channelRouteBase, slug);
    const historyMethod = historyMode === 'replace' ? 'replaceState' : 'pushState';
    if (window.location.pathname !== channelPath) {
      window.history[historyMethod]({ channelSlug: slug }, '', channelPath);
    }
  }

  function selectChannel(channel, { historyMode = 'push' } = {}) {
    player.suspend();
    currentChannel = channel;
    currentChannelHasPlayed = false;
    statusEl.hidden = true;
    showPlayerPlaceholder(`Loading ${channel.name.replace(/\s*\(\d{3,4}[pi]\)\s*$/i, '')}…`);
    updateNowPlayingSummary(channel);
    updatePlaybackLabel('Tuning');
    showPlayerHud(channel);
    setLastWatched(window.localStorage, channel.url);
    appView?.setNowPlaying(channel.url);
    syncChannelRoute(channel, historyMode);
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

  function navigateChannelFromButton(event, direction) {
    event.stopPropagation();
    navigateChannel(direction);
    if (!isTvMode) event.currentTarget.blur();
    showChannelNavTemporarily();
  }

  function updatePlayPauseButton() {
    const isPlaying = isPlaybackActive();
    playPauseButton.disabled = !currentChannel;
    playPauseButton.dataset.playing = String(isPlaying);
    playPauseButton.setAttribute('aria-pressed', String(isPlaying));
    playPauseButton.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    playPauseButton.title = isPlaying ? 'Pause' : 'Play';
  }

  function updateChannelNavButtons() {
    const disabled = visibleChannels.length < 2;
    previousChannelButton.disabled = disabled;
    nextChannelButton.disabled = disabled;
    updatePlayPauseButton();
  }

  function setChannelNavVisible(isVisible) {
    clearTimeout(channelNavHideTimer);
    channelNavHideTimer = null;
    layoutEl.classList.toggle(
      'channel-nav-visible',
      Boolean(isVisible),
    );
  }

  function showChannelNavTemporarily() {
    setChannelNavVisible(true);
    channelNavHideTimer = window.setTimeout(() => {
      if (isTvMode && tvPanel !== 'none') return;
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
    void player.resume();
    syncMediaSession(true);
    updatePlayPauseButton();
  }

  function pauseCurrentVideo() {
    videoEl.pause();
    syncMediaSession(false);
    updatePlayPauseButton();
  }

  function suspendCurrentVideo() {
    player.suspend();
    syncMediaSession(false);
    updatePlayPauseButton();
  }

  function toggleCurrentVideo() {
    if (videoEl.paused) {
      playCurrentVideo();
      return;
    }
    pauseCurrentVideo();
  }

  function getFeaturedServiceLinks() {
    return [...featuredServiceList.querySelectorAll('.featured-service-link')];
  }

  function getPlayerControlButtons() {
    return [previousChannelButton, playPauseButton, nextChannelButton]
      .filter((button) => !button.disabled);
  }

  function focusPlayerControl(index) {
    const buttons = getPlayerControlButtons();
    const preferred = playPauseButton.disabled ? buttons[0] : playPauseButton;
    const target = Number.isInteger(index) ? buttons[index] : preferred;
    if (!target) return false;
    target.focus({ preventScroll: true });
    return true;
  }

  function movePlayerControlFocus(direction) {
    const buttons = getPlayerControlButtons();
    if (!buttons.length) return false;
    const currentIndex = buttons.indexOf(document.activeElement);
    const nextIndex = getWrappedFocusIndex(buttons.length, currentIndex, direction);
    return focusPlayerControl(nextIndex);
  }

  function focusFeaturedService(index = 0) {
    const links = getFeaturedServiceLinks();
    const target = links[index] || links[0];
    if (!target) return false;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return true;
  }

  function moveFeaturedServiceFocus(direction) {
    const links = getFeaturedServiceLinks();
    if (!links.length) return false;
    const currentIndex = links.indexOf(document.activeElement);
    const nextIndex = getWrappedFocusIndex(links.length, currentIndex, direction);
    return focusFeaturedService(nextIndex);
  }

  function handleTvRemoteAction(action) {
    switch (action) {
      case 'left':
      case 'right':
        setTvPanel(getTvHorizontalPanelAction(tvPanel, action));
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
    if (!isTvMode && shouldActivateTelevisionFromRemote({
      event,
      viewportWidth: window.innerWidth,
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
    })) {
      activateTelevisionMode();
    }
    if (!isTvMode) return;

    const key = getTvNavigationKey(event);

    if (tvPanel === 'playback') {
      const horizontalDirection = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;
      if (horizontalDirection && movePlayerControlFocus(horizontalDirection)) {
        event.preventDefault();
        return;
      }
      if (key === 'ArrowDown' && getFeaturedServiceLinks().length) {
        event.preventDefault();
        setTvPanel('services');
        return;
      }
      if (key === 'ArrowUp' || key === 'Escape' || key === 'BrowserBack') {
        event.preventDefault();
        setTvPanel('none');
        return;
      }
    }

    if (tvPanel === 'categories') {
      const horizontalDirection = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;
      if (horizontalDirection && appView?.moveCategoryFocus(horizontalDirection)) {
        event.preventDefault();
        return;
      }
      if (key === 'ArrowDown') {
        event.preventDefault();
        setTvPanel(getTvVerticalPanelAction(tvPanel, 'down'));
        return;
      }
      if (key === 'ArrowUp') {
        event.preventDefault();
        setTvPanel(getTvVerticalPanelAction(tvPanel, 'up'));
        return;
      }
      if (key === 'Escape' || key === 'BrowserBack') {
        event.preventDefault();
        setTvPanel('none');
        return;
      }
    }

    if (tvPanel === 'channel-services') {
      const horizontalDirection = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;
      if (horizontalDirection && appView?.moveChannelServiceFocus(horizontalDirection)) {
        event.preventDefault();
        return;
      }
      if (key === 'ArrowDown') {
        event.preventDefault();
        setTvPanel(getTvVerticalPanelAction(tvPanel, 'down'));
        return;
      }
      if (key === 'ArrowUp' || key === 'Escape' || key === 'BrowserBack') {
        event.preventDefault();
        setTvPanel('none');
        return;
      }
    }

    if (tvPanel === 'services') {
      const horizontalDirection = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;
      if (horizontalDirection && moveFeaturedServiceFocus(horizontalDirection)) {
        event.preventDefault();
        return;
      }
      if (key === 'ArrowUp') {
        event.preventDefault();
        setTvPanel('playback');
        return;
      }
      if (key === 'Escape' || key === 'BrowserBack') {
        event.preventDefault();
        setTvPanel('none');
        return;
      }
    }

    const action = getGlobalTvRemoteAction({
      key,
      code: event.code,
      keyCode: event.keyCode,
    });
    if (action && handleTvRemoteAction(action)) {
      event.preventDefault();
      return;
    }

    const direction = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
    if (key === 'ArrowUp' && tvPanel === 'channels' && appView?.isFirstChannelFocused()) {
      event.preventDefault();
      setTvPanel(getTvVerticalPanelAction(tvPanel, 'up'));
      return;
    }
    if (direction && tvPanel === 'channels' && appView?.moveChannelFocus(direction)) {
      event.preventDefault();
      return;
    }
    if (direction && tvPanel === 'settings' && appView?.moveMenuFocus(direction)) {
      event.preventDefault();
      return;
    }

    if (key === 'ArrowDown' && tvPanel === 'none') {
      event.preventDefault();
      setTvPanel('playback');
      return;
    }

    if ((key === 'Enter' || key === ' ') && tvPanel === 'none') {
      event.preventDefault();
      setTvPanel('playback');
    }
  }

  async function boot() {
    retryButton.hidden = true;
    root.textContent = 'Loading channels...';

    try {
      const channels = await loadChannels({
        fetchImpl: window.fetch.bind(window),
        sessionStore: window.sessionStorage,
        privateStore: androidDeviceBridge ? window.localStorage : null,
      });
      channelRoutes = createChannelRouteIndex(channels);

      appView = renderApp({
        root,
        channels,
        favoritesApi,
        themeApi,
        playlistAccessApi,
        onSelectChannel: selectChannel,
        onVisibleChannelsChange: setVisibleChannels,
        onMenuOpenChange: (isOpen) => {
          layoutEl.classList.toggle('settings-open', isOpen);
          if (!isTvMode || syncingTvPanel) return;
          if (isOpen && tvPanel !== 'settings') setTvPanel('settings');
          if (!isOpen && tvPanel === 'settings') setTvPanel('none');
        },
      });
      window.__rugareTvReady = true;
      renderFeaturedServices(
        document.getElementById('channel-featured-service-list'),
        { focusable: true },
      );
      window.__ftaIptvUpdateStatus = (message) => appView?.setUpdateStatus(message);

      if (isTvMode) setTvPanel('none');

      const requestedSlug = channelRoutingEnabled
        ? getRequestedChannelSlug(window.location.pathname, channelRouteBase)
        : '';
      const requestedChannel = requestedSlug
        ? channelRoutes.channelBySlug.get(requestedSlug)
        : null;
      if (requestedChannel) {
        selectChannel(requestedChannel, { historyMode: 'replace' });
        window.requestAnimationFrame(() => appView?.scrollToChannel(requestedChannel.url));
        return;
      }

      if (requestedSlug) {
        statusEl.textContent = `Channel “${requestedSlug.replace(/-/g, ' ')}” was not found. Choose another channel.`;
        statusEl.hidden = false;
        if (isTvMode) setTvPanel('channels');
        return;
      }

      const lastWatchedUrl = getLastWatched(window.localStorage);
      const lastChannel = channels.find((c) => c.url === lastWatchedUrl);
      if (lastChannel) {
        selectChannel(lastChannel, { historyMode: 'replace' });
        window.requestAnimationFrame(() => appView?.scrollToChannel(lastChannel.url));
      } else if (isTvMode) {
        setTvPanel('channels');
      }
    } catch (err) {
      root.textContent = `Failed to load channel list: ${err.message}`;
      retryButton.hidden = false;
    }
  }

  nowPlayingFavorite.addEventListener('click', () => {
    if (!currentChannel) return;
    favoritesApi.toggle(currentChannel.url);
    updateNowPlayingSummary(currentChannel);
    appView?.refresh();
  });

  settingsToggle.addEventListener('click', () => appView?.setMenuOpen(true));

  function updateOrientationButton() {
    const landscape = window.matchMedia('(orientation: landscape)').matches;
    const label = landscape ? 'Switch to portrait' : 'Switch to landscape';
    playerOrientationToggle.setAttribute('aria-label', label);
  }

  playerOrientationToggle.addEventListener('click', () => {
    try {
      androidDeviceBridge?.toggleOrientation?.();
    } catch {
      // The hosted browser build does not control device orientation.
    }
  });
  window.matchMedia('(orientation: landscape)').addEventListener('change', updateOrientationButton);
  updateOrientationButton();

  retryButton.addEventListener('click', boot);
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    playerPanelEl.addEventListener('mousemove', showChannelNavTemporarily);
  }
  videoEl.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    showChannelNavTemporarily();
  });
  previousChannelButton.addEventListener('click', (event) => {
    navigateChannelFromButton(event, -1);
  });
  playPauseButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (currentChannel) toggleCurrentVideo();
    if (!isTvMode) event.currentTarget.blur();
    showChannelNavTemporarily();
  });
  nextChannelButton.addEventListener('click', (event) => {
    navigateChannelFromButton(event, 1);
  });
  videoEl.addEventListener('playing', () => {
    updatePlaybackLabel('Now playing');
    syncMediaSession(true);
    updatePlayPauseButton();
  });
  videoEl.addEventListener('play', () => {
    syncMediaSession(true);
    updatePlayPauseButton();
  });
  videoEl.addEventListener('pause', () => {
    if (currentChannel) updatePlaybackLabel('Paused');
    syncMediaSession(false);
    updatePlayPauseButton();
  });
  videoEl.addEventListener('ended', () => {
    if (currentChannel) updatePlaybackLabel('Ended');
    syncMediaSession(false);
    updatePlayPauseButton();
  });
  document.addEventListener('keydown', handleTvKeydown);
  window.addEventListener('popstate', () => {
    const slug = getRequestedChannelSlug(window.location.pathname, channelRouteBase);
    const channel = channelRoutes.channelBySlug.get(slug);
    if (channel && channel.url !== currentChannel?.url) {
      selectChannel(channel, { historyMode: 'none' });
    }
  });
  window.__ftaIptvPreviousChannel = () => navigateChannel(-1);
  window.__ftaIptvNextChannel = () => navigateChannel(1);
  window.__ftaIptvPlay = playCurrentVideo;
  window.__ftaIptvPause = pauseCurrentVideo;
  window.__ftaIptvSuspendPlayback = suspendCurrentVideo;
  window.__ftaIptvTogglePlayback = toggleCurrentVideo;
  window.__ftaIptvShowControlsAt = (relativeX, relativeY) => {
    const playerBounds = playerFrameEl.getBoundingClientRect();
    const touchX = Number(relativeX) * window.innerWidth;
    const touchY = Number(relativeY) * window.innerHeight;
    if (touchX >= playerBounds.left && touchX <= playerBounds.right
      && touchY >= playerBounds.top && touchY <= playerBounds.bottom) {
      showChannelNavTemporarily();
    }
  };
  window.__ftaIptvOpenChannels = () => {
    if (isTvMode || !isLandscapeDrawerActive()) return;
    appView?.setMenuOpen(false);
    setDrawerOpen(true);
  };
  window.__ftaIptvTvLeft = () => handleTvRemoteAction('left');
  window.__ftaIptvTvRight = () => handleTvRemoteAction('right');
  window.__ftaIptvTvToggleChannels = () => toggleTvPanel('channels');
  window.__ftaIptvTvToggleMenu = () => toggleTvPanel('settings');
  window.__ftaIptvTvClosePanel = () => handleTvRemoteAction('close');
  window.addEventListener('pagehide', () => {
    delete window.__ftaIptvUpdateStatus;
    clearTimeout(channelTuneTimer);
    clearTimeout(channelNavHideTimer);
    clearTimeout(playerHudHideTimer);
    clearTimeout(playerPlaceholderTimer);
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

main().catch((err) => {
  const root = document.getElementById('app');
  const retryButton = document.getElementById('retry-button');
  if (root) root.textContent = `Failed to start Rugare TV: ${err.message}`;
  if (retryButton) {
    retryButton.hidden = false;
    retryButton.textContent = 'Reload';
    retryButton.onclick = () => window.location.reload();
  }
});
