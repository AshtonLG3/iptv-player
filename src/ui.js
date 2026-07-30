import { APP_NAME, APP_VERSION, FTA_COUNTRIES } from './constants.js';
import { getWrappedFocusIndex } from './tvRemote.js';

export const CONTENT_CATEGORIES = Object.freeze([
  'News',
  'Sports',
  'Movies',
  'Entertainment',
  'Wildlife',
  'Documentary',
  'Kids',
  'Music',
  'Lifestyle',
  'General',
]);

const CONTENT_CATEGORY_RULES = [
  ['News', /\b(news|newsy|newsmax|newsnet|cnbc|bloomberg|al jazeera|france 24|talktv|ln24sa|k24|africanews|tv brics|knbc|wxii|ksnv|kcra|kob|ksby)\b/i],
  ['Movies', /(movie|film|cinema|flix|romance)/i],
  ['Wildlife', /\b(bbc earth|wild(?:earth| nature| tv)?|nature time|adventure earth|animal|zoo|safari)\b/i],
  ['Kids', /\b(kids?|moonbug|teletubbies|tiny pop|cartoons?|toon|baby|junior)\b/i],
  ['Music', /\b(afrobeats?|music|rock|concerts?|dance|trace uk|totalmusic)\b|that's (?:70s|80s)/i],
  ['Documentary', /\b(history|true crime|jail|wonder|space live|documentar|bloomberg originals)\b/i],
  ['Lifestyle', /\b(travel|top gear|hobby maker|gems tv|qvc|horse & country|english club|food|cook|home|garden|fashion|health|fitness)\b/i],
  ['Entertainment', /\b(ent channel|mr bean|graham norton|chat show|pop|competition|game show|reality|comedy)\b/i],
];

function isGeoBlockedChannel(channel) {
  return /\[geo-blocked\]/i.test(channel.name);
}

function isSportsChannel(channel) {
  return getContentCategory(channel) === 'Sports';
}

function isIntermittentChannel(channel) {
  return /\[not 24\/7\]/i.test(channel.name);
}

export function getChannelInitials(name) {
  const words = String(name || '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return 'TV';
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

export function resolveChannelLogoUrl(logoUrl, locationObj = globalThis.location) {
  const originalUrl = String(logoUrl || '');
  if (!originalUrl || locationObj?.hostname !== 'appassets.androidplatform.net') {
    return originalUrl;
  }

  try {
    const parsedUrl = new URL(originalUrl);
    if (parsedUrl.hostname !== 'mangezi.xyz' || !parsedUrl.pathname.startsWith('/tv/assets/')) {
      return originalUrl;
    }

    return `https://appassets.androidplatform.net/assets${parsedUrl.pathname.slice('/tv'.length)}${parsedUrl.search}`;
  } catch {
    return originalUrl;
  }
}

function getPrimaryCategory(channel) {
  return getContentCategory(channel);
}

function createChannelArtwork(channel) {
  const artwork = document.createElement('span');
  artwork.className = 'channel-artwork';

  const fallback = document.createElement('span');
  fallback.className = 'channel-artwork-fallback';
  fallback.textContent = getChannelInitials(channel.name);
  fallback.setAttribute('aria-hidden', 'true');
  artwork.appendChild(fallback);

  if (channel.logo) {
    const image = document.createElement('img');
    image.src = resolveChannelLogoUrl(channel.logo);
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => image.remove(), { once: true });
    artwork.appendChild(image);
  }

  return artwork;
}

export function getCategoryNames(category) {
  return String(category || '')
    .split(/[;,|]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

export function getContentCategory(channel) {
  const sourceCategories = getCategoryNames(channel?.category);
  if (sourceCategories.some((category) => category === 'Sports' || category === 'Cue Sports')) {
    return 'Sports';
  }

  const name = String(channel?.name || '').trim();
  const matchingRule = CONTENT_CATEGORY_RULES.find(([, pattern]) => pattern.test(name));
  return matchingRule?.[0] || 'General';
}

export function channelMatchesCategory(channel, category) {
  if (!category) return true;
  return getContentCategory(channel) === category;
}

export function filterChannelsForUi(
  channels,
  {
    search = '',
    country = '',
    category = '',
    hideGeoBlocked = true,
    favoritesOnly = false,
    isFavorite = () => false,
  } = {},
) {
  const normalizedSearch = search.trim().toLowerCase();

  return channels.filter((channel) => {
    if (normalizedSearch && !channel.name.toLowerCase().includes(normalizedSearch)) return false;
    if (country && channel.country !== country) return false;
    if (!channelMatchesCategory(channel, category)) return false;
    if (hideGeoBlocked && isGeoBlockedChannel(channel) && !isSportsChannel(channel)) return false;
    if (favoritesOnly && !isFavorite(channel.url)) return false;
    return true;
  });
}

export function renderApp({
  root,
  channels,
  favoritesApi,
  themeApi,
  playlistAccessApi = null,
  onSelectChannel,
  onVisibleChannelsChange = null,
  onMenuOpenChange = null,
}) {
  root.innerHTML = `
    <aside class="sidebar">
      <header class="app-menu">
        <details class="overflow-menu" id="overflow-menu">
          <summary class="overflow-menu-button" aria-label="Open menu">
            <span class="hamburger-icon" aria-hidden="true"></span>
          </summary>
          <div class="overflow-menu-panel">
            <div class="menu-panel-title">
              <div>
                <p class="menu-kicker">Player</p>
                <h1>${APP_NAME}</h1>
                <span class="version-pill">v${APP_VERSION}</span>
              </div>
              <button class="menu-close-button" type="button" aria-label="Close settings"></button>
            </div>
            <input type="search" id="search-box" placeholder="Search channels..." />
            <select id="country-filter"><option value="">All countries</option></select>
            <select id="category-filter"><option value="">All categories</option></select>
            <label class="blocked-label">
              <input type="checkbox" id="hide-blocked-toggle" checked /> Hide geo-blocked (except sports)
            </label>
            <label class="favorites-label">
              <input type="checkbox" id="favorites-toggle" /> Favorites only
            </label>
            <label class="theme-control" for="theme-select">
              <span>Theme</span>
              <select id="theme-select">
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
            <details class="playlist-access">
              <summary>Playlist links</summary>
              <div id="playlist-link-list" class="playlist-link-list"></div>
              <p id="playlist-action-status" class="playlist-action-status" role="status"></p>
              <div id="compatible-player-list" class="compatible-player-list"></div>
            </details>
          </div>
        </details>
        <div class="app-title">
          <p class="menu-kicker">Player</p>
          <h1>${APP_NAME}</h1>
          <span class="version-pill">v${APP_VERSION}</span>
        </div>
      </header>
      <section class="channel-browser-header" aria-label="Channel browser">
        <div class="channel-list-heading">
          <div>
            <span class="channel-list-kicker">Browse</span>
            <strong id="channel-list-title">All channels</strong>
          </div>
          <span id="channel-count" class="channel-count">0</span>
        </div>
        <div id="category-strip" class="category-strip" aria-label="Quick categories"></div>
      </section>
      <ul id="channel-list"></ul>
    </aside>
  `;

  const searchBox = root.querySelector('#search-box');
  const themeSelect = root.querySelector('#theme-select');
  const countrySelect = root.querySelector('#country-filter');
  const categorySelect = root.querySelector('#category-filter');
  const hideBlockedToggle = root.querySelector('#hide-blocked-toggle');
  const favoritesToggle = root.querySelector('#favorites-toggle');
  const overflowMenu = root.querySelector('#overflow-menu');
  const overflowMenuButton = root.querySelector('.overflow-menu-button');
  const menuCloseButton = root.querySelector('.menu-close-button');
  const playlistLinkList = root.querySelector('#playlist-link-list');
  const playlistActionStatus = root.querySelector('#playlist-action-status');
  const compatiblePlayerList = root.querySelector('#compatible-player-list');
  const categoryStrip = root.querySelector('#category-strip');
  const channelListTitle = root.querySelector('#channel-list-title');
  const channelCount = root.querySelector('#channel-count');
  const listEl = root.querySelector('#channel-list');
  let nowPlayingUrl = null;
  let visibleChannels = [];

  const countryCounts = channels.reduce((counts, channel) => {
    counts[channel.country] = (counts[channel.country] || 0) + 1;
    return counts;
  }, {});

  for (const [code, name] of Object.entries(FTA_COUNTRIES)) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = `${name} (${countryCounts[code] || 0})`;
    countrySelect.appendChild(opt);
  }

  const availableCategories = new Set(channels.map((channel) => getContentCategory(channel)));
  const categories = CONTENT_CATEGORIES.filter((category) => availableCategories.has(category));
  for (const category of categories) {
    const opt = document.createElement('option');
    opt.value = category;
    opt.textContent = category;
    categorySelect.appendChild(opt);
  }

  renderCategoryStrip();

  if (playlistAccessApi) {
    renderPlaylistAccess();
  }

  function applyFilters({ relaxCountryWhenCategoryEmpty = false } = {}) {
    const filters = {
      search: searchBox.value,
      country: countrySelect.value,
      category: categorySelect.value,
      hideGeoBlocked: hideBlockedToggle.checked,
      favoritesOnly: favoritesToggle.checked,
      isFavorite: (url) => favoritesApi.isFavorite(url),
    };

    let filtered = filterChannelsForUi(channels, filters);
    if (
      relaxCountryWhenCategoryEmpty
      && filters.country
      && filters.category
      && filtered.length === 0
    ) {
      const categoryFiltered = filterChannelsForUi(channels, { ...filters, country: '' });
      if (categoryFiltered.length > 0) {
        countrySelect.value = '';
        filtered = categoryFiltered;
      }
    }

    visibleChannels = filtered;
    syncCategoryStrip();
    channelListTitle.textContent = filters.category || (filters.favoritesOnly ? 'Favorites' : 'All channels');
    channelCount.textContent = String(filtered.length);
    renderList(filtered);
    onVisibleChannelsChange?.(visibleChannels);
  }

  function renderList(list) {
    const focusedChannelUrl = document.activeElement
      ?.closest?.('.channel-item')
      ?.dataset.channelUrl;
    listEl.innerHTML = '';
    if (list.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'empty-state';
      emptyItem.textContent = 'No channels found for this filter.';
      listEl.appendChild(emptyItem);
      return;
    }

    for (const channel of list) {
      const item = document.createElement('li');
      item.className = 'channel-item';
      item.dataset.channelUrl = channel.url;

      const selectButton = document.createElement('button');
      selectButton.type = 'button';
      selectButton.className = 'channel-select-button';
      selectButton.setAttribute('aria-label', `Play ${channel.name}`);

      const artwork = createChannelArtwork(channel);

      const name = document.createElement('span');
      name.className = 'channel-name';
      name.textContent = channel.name;

      const badge = document.createElement('span');
      badge.className = 'now-playing-badge';
      badge.textContent = 'Now playing';

      const meta = document.createElement('span');
      meta.className = 'channel-meta';
      const detail = document.createElement('span');
      detail.className = 'channel-detail';
      const countryName = FTA_COUNTRIES[channel.country] || channel.country?.toUpperCase();
      detail.textContent = [getPrimaryCategory(channel), countryName].filter(Boolean).join(' · ');
      meta.append(name, detail, badge);

      if (isGeoBlockedChannel(channel) || isIntermittentChannel(channel)) {
        const flags = document.createElement('span');
        flags.className = 'channel-flags';
        if (isGeoBlockedChannel(channel)) {
          const flag = document.createElement('span');
          flag.className = 'channel-flag warning';
          flag.textContent = 'Geo-blocked';
          flags.appendChild(flag);
        }
        if (isIntermittentChannel(channel)) {
          const flag = document.createElement('span');
          flag.className = 'channel-flag';
          flag.textContent = 'Not 24/7';
          flags.appendChild(flag);
        }
        meta.appendChild(flags);
      }

      selectButton.append(artwork, meta);
      item.appendChild(selectButton);

      const favButton = document.createElement('button');
      favButton.type = 'button';
      favButton.className = 'favorite-btn';
      favButton.textContent = favoritesApi.isFavorite(channel.url) ? '★' : '☆';
      favButton.setAttribute('aria-label', `Toggle favorite for ${channel.name}`);
      if (document.documentElement.classList.contains('tv-mode')) favButton.tabIndex = -1;
      favButton.addEventListener('click', (event) => {
        event.stopPropagation();
        favoritesApi.toggle(channel.url);
        applyFilters();
      });

      item.appendChild(favButton);
      selectButton.addEventListener('click', () => {
        setNowPlaying(channel.url);
        onSelectChannel(channel);
      });
      listEl.appendChild(item);
    }

    updateNowPlayingMarkers();
    if (focusedChannelUrl) focusChannel(focusedChannelUrl);
  }

  function updateNowPlayingMarkers() {
    for (const item of listEl.querySelectorAll('.channel-item')) {
      const isPlaying = item.dataset.channelUrl === nowPlayingUrl;
      item.classList.toggle('now-playing', isPlaying);
      item.setAttribute('aria-current', isPlaying ? 'true' : 'false');
    }
  }

  function renderCategoryStrip() {
    categoryStrip.innerHTML = '';
    for (const category of ['', ...categories]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'category-chip';
      button.dataset.category = category;
      button.textContent = category || 'All';
      button.addEventListener('click', () => {
        categorySelect.value = category;
        applyFilters({ relaxCountryWhenCategoryEmpty: true });
      });
      categoryStrip.appendChild(button);
    }
  }

  function syncCategoryStrip() {
    for (const button of categoryStrip.querySelectorAll('.category-chip')) {
      const selected = button.dataset.category === categorySelect.value;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
  }

  function setNowPlaying(url) {
    nowPlayingUrl = url;
    updateNowPlayingMarkers();
  }

  function setMenuOpen(isOpen) {
    overflowMenu.open = Boolean(isOpen);
  }

  function focusChannel(url = nowPlayingUrl) {
    const items = [...listEl.querySelectorAll('.channel-item')];
    const target = items.find((item) => item.dataset.channelUrl === url) || items[0];
    const button = target?.querySelector('.channel-select-button');
    if (!button) return false;
    button.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'nearest' });
    return true;
  }

  function scrollToChannel(url = nowPlayingUrl) {
    const target = [...listEl.querySelectorAll('.channel-item')]
      .find((item) => item.dataset.channelUrl === url);
    if (!target) return false;
    listEl.scrollTop = Math.max(0, target.offsetTop - listEl.offsetTop);
    return true;
  }

  function moveChannelFocus(direction) {
    const buttons = [...listEl.querySelectorAll('.channel-select-button')];
    const currentIndex = buttons.indexOf(document.activeElement);
    if (!buttons.length) return false;
    const nextIndex = getWrappedFocusIndex(buttons.length, currentIndex, direction);
    const button = buttons[nextIndex];
    button.focus({ preventScroll: true });
    button.closest('.channel-item')?.scrollIntoView({ block: 'nearest' });
    return true;
  }

  function getMenuFocusables() {
    return [...root.querySelectorAll(
      '.overflow-menu-panel button, .overflow-menu-panel input, .overflow-menu-panel select, '
      + '.overflow-menu-panel summary, .overflow-menu-panel a',
    )].filter((element) => !element.disabled && element.getClientRects().length > 0);
  }

  function focusMenu() {
    const target = countrySelect || getMenuFocusables()[0];
    if (!target) return false;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'nearest' });
    return true;
  }

  function moveMenuFocus(direction) {
    const focusables = getMenuFocusables();
    if (!focusables.length) return false;
    const currentIndex = focusables.indexOf(document.activeElement);
    const nextIndex = getWrappedFocusIndex(focusables.length, currentIndex, direction);
    const target = focusables[nextIndex];
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'nearest' });
    return true;
  }

  function renderPlaylistAccess() {
    playlistLinkList.innerHTML = '';
    compatiblePlayerList.innerHTML = '';

    for (const playlist of playlistAccessApi.playlists) {
      const url = playlistAccessApi.resolveUrl(playlist);
      const row = document.createElement('section');
      row.className = 'playlist-link-row';

      const text = document.createElement('div');
      text.className = 'playlist-link-text';

      const name = document.createElement('strong');
      name.textContent = playlist.name;

      const description = document.createElement('span');
      description.textContent = playlist.description;

      text.append(name, description);

      const actions = document.createElement('div');
      actions.className = 'playlist-actions';

      const openLink = document.createElement('a');
      openLink.href = url;
      openLink.target = '_blank';
      openLink.rel = 'noopener';
      openLink.className = 'playlist-action';
      openLink.textContent = 'Open M3U';

      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'playlist-action';
      copyButton.textContent = 'Copy URL';
      copyButton.addEventListener('click', async () => {
        try {
          await playlistAccessApi.copyUrl(url);
          setPlaylistStatus(`${playlist.name} URL copied.`);
        } catch (err) {
          setPlaylistStatus(`Copy failed: ${err.message}`);
        }
      });

      actions.append(openLink, copyButton);

      if (playlistAccessApi.canShare()) {
        const shareButton = document.createElement('button');
        shareButton.type = 'button';
        shareButton.className = 'playlist-action';
        shareButton.textContent = 'Share';
        shareButton.addEventListener('click', async () => {
          try {
            await playlistAccessApi.sharePlaylist({ name: playlist.name, url });
            setPlaylistStatus(`${playlist.name} shared.`);
          } catch (err) {
            if (err.name !== 'AbortError') setPlaylistStatus(`Share failed: ${err.message}`);
          }
        });
        actions.appendChild(shareButton);
      }

      if (playlistAccessApi.canOpenInApp()) {
        const appButton = document.createElement('button');
        appButton.type = 'button';
        appButton.className = 'playlist-action primary';
        appButton.textContent = 'Open app';
        appButton.addEventListener('click', () => {
          setPlaylistStatus(`Opening ${playlist.name} in a compatible app.`);
          playlistAccessApi.openInApp(url);
        });
        actions.appendChild(appButton);
      }

      row.append(text, actions);
      playlistLinkList.appendChild(row);
    }

    const installTitle = document.createElement('strong');
    installTitle.textContent = 'Compatible players';
    compatiblePlayerList.appendChild(installTitle);

    for (const playerLink of playlistAccessApi.compatiblePlayers) {
      const link = document.createElement('a');
      link.href = playerLink.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.className = 'compatible-player-link';
      link.textContent = `${playerLink.name} - ${playerLink.platform}`;
      compatiblePlayerList.appendChild(link);
    }
  }

  function setPlaylistStatus(message) {
    playlistActionStatus.textContent = message;
  }

  root.addEventListener('click', (event) => {
    const inAppLink = event.target.closest?.('a[data-in-app-browser="true"]');
    if (inAppLink && typeof window.AndroidDevice?.openOfficialUrl === 'function') {
      event.preventDefault();
      window.AndroidDevice.openOfficialUrl(inAppLink.href);
    }
    if (!overflowMenu.contains(event.target)) overflowMenu.removeAttribute('open');
  });

  overflowMenu.addEventListener('toggle', () => {
    overflowMenuButton.setAttribute(
      'aria-label',
      overflowMenu.open ? 'Close menu' : 'Open menu',
    );
    onMenuOpenChange?.(overflowMenu.open);
  });
  menuCloseButton.addEventListener('click', () => setMenuOpen(false));

  searchBox.addEventListener('input', applyFilters);
  themeSelect.value = themeApi.get();
  themeSelect.addEventListener('change', () => themeApi.set(themeSelect.value));
  countrySelect.addEventListener('change', applyFilters);
  categorySelect.addEventListener('change', () => applyFilters({ relaxCountryWhenCategoryEmpty: true }));
  hideBlockedToggle.addEventListener('change', applyFilters);
  favoritesToggle.addEventListener('change', applyFilters);

  applyFilters();

  return {
    refresh: applyFilters,
    setNowPlaying,
    setMenuOpen,
    focusChannel,
    scrollToChannel,
    moveChannelFocus,
    focusMenu,
    moveMenuFocus,
    getVisibleChannels: () => visibleChannels.slice(),
  };
}
