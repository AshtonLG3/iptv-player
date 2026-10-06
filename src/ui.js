import { APP_NAME, APP_VERSION, FTA_COUNTRIES } from './constants.js?v=20261006i';
import { getBoundedFocusIndex, getWrappedFocusIndex } from './tvRemote.js?v=20261006i';
import { getMediaSection } from './catalog.js?v=20261006i';

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
export const MAX_RENDERED_CHANNELS = 500;

const CONTENT_CATEGORY_RULES = [
  ['News', /\b(news|newsy|newsmax|newsnet|cnbc|bloomberg|al jazeera|france 24|talktv|ln24sa|k24|africanews|tv brics|knbc|wxii|ksnv|kcra|kob|ksby|lehae)\b/i],
  ['Movies', /(movie|film|cinema|flix|romance|nolly|afroland\s+(?:tv|drama))/i],
  ['Wildlife', /\b(national geographic|nat geo|bbc earth|wild(?:earth| nature| tv)?|nature time|adventure earth|animal|zoo|safari)\b/i],
  ['Kids', /\b(kids?|moonbug|teletubbies|tiny pop|cartoons?|toon|baby|junior)\b/i],
  ['Music', /\b(afrobeats?|music|rock|concerts?|dance|trace uk|totalmusic)\b|that's (?:70s|80s)/i],
  ['Documentary', /\b(history|true crime|jail|wonder|space live|documentar|national geographic|nat geo|bloomberg originals)\b/i],
  ['Lifestyle', /\b(travel|top gear|hobby maker|gems tv|qvc|horse & country|english club|food|cook|home|garden|fashion|health|fitness)\b/i],
  ['Entertainment', /\b(ent channel|mr bean|graham norton|chat show|pop|competition|game show|reality|comedy)\b/i],
];

const CHANNEL_NAME_COLLATOR = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base',
});

export function supportsNativeUpdates(androidDevice) {
  return typeof androidDevice?.checkForUpdate === 'function';
}

function getSortableChannelName(channel) {
  return String(channel?.name || '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sortChannelsAlphabetically(channels) {
  return [...channels].sort((left, right) => {
    const primary = CHANNEL_NAME_COLLATOR.compare(
      getSortableChannelName(left),
      getSortableChannelName(right),
    );
    return primary || CHANNEL_NAME_COLLATOR.compare(left?.name || '', right?.name || '');
  });
}

export function limitChannelsForRendering(channels, limit = MAX_RENDERED_CHANNELS) {
  return channels.slice(0, limit);
}

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
  if (getMediaSection(channel) !== 'live') return sourceCategories[0] || 'General';
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
    hideGeoBlocked = false,
    favoritesOnly = false,
    isFavorite = () => false,
    mediaSection = '',
  } = {},
) {
  const normalizedSearch = search.trim().toLowerCase();

  return channels.filter((channel) => {
    if (mediaSection && getMediaSection(channel) !== mediaSection) return false;
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
  onFavoriteChange = null,
  onBack = null,
  onMenuOpenChange = null,
  onBrowseSelection = null,
  onSettingsSelection = null,
  qualityApi = null,
}) {
  root.innerHTML = `
    <aside class="sidebar">
      <header class="app-menu">
        <details class="overflow-menu" id="overflow-menu">
          <summary class="overflow-menu-button" aria-label="Open menu">
            <span class="hamburger-icon" aria-hidden="true"></span>
          </summary>
          <div class="overflow-menu-panel">
            <button class="mobile-menu-back" type="button" aria-label="Back">‹</button>
            <div class="menu-panel-title">
              <div>
                <p class="menu-kicker">Player</p>
                <img class="app-brand-logo" src="assets/branding/rugare-tv-logo.png" alt="${APP_NAME}" />
                <span class="version-pill">v${APP_VERSION}</span>
              </div>
              <button class="menu-close-button" type="button" aria-label="Close settings"></button>
            </div>
            <button id="tv-countries-button" class="tv-only tv-root-action" type="button">Countries</button>
            <label class="country-control">
              <select id="country-filter"><option value="">All countries</option></select>
            </label>
            <button id="tv-settings-button" class="tv-only tv-root-action" type="button">Settings</button>
            <button id="tv-exit-button" class="tv-only tv-root-action" type="button">Exit app</button>
            <h2 class="tv-only tv-preferences-title">Settings</h2>
            <div class="tv-settings-content">
            <select id="category-filter"><option value="">All categories</option></select>
            <label class="blocked-label" title="Sports channels remain visible">
              <input type="checkbox" id="hide-blocked-toggle" aria-label="Hide geo-blocked except sports" /> Hide geo-blocked<span class="tv-hide"> (except sports)</span>
            </label>
            <label class="favorites-label">
              <input type="checkbox" id="favorites-toggle" /> Favorites only
            </label>
            <div class="tv-only tv-theme-choices" aria-label="Theme"><span>Theme</span><button type="button" data-theme-choice="light" aria-label="Light theme">☀</button><button type="button" data-theme-choice="dark" aria-label="Dark theme">☾</button></div>
            <label class="theme-control legacy-theme-control" for="theme-select">
              <span>Theme</span>
              <select id="theme-select">
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
            <button id="tv-quality-button" class="tv-only tv-root-action" type="button">Quality <span id="tv-quality-value"></span> ▾</button>
            <div id="tv-quality-options" class="tv-only" hidden><button type="button" data-quality="auto">Auto</button><button type="button" data-quality="data-saver">Data saver</button></div>
            <label class="theme-control legacy-quality-control" for="quality-select">
              <span>Quality</span>
              <select id="quality-select">
                <option value="auto">Auto (adapts to connection)</option>
                <option value="data-saver">Data saver (up to 480p when available)</option>
              </select>
            </label>
            <a class="menu-download-link browser-download-link" download href="downloads/rugare-tv.apk">
              Download Rugare TV for Android
            </a>
            <details class="epg-settings">
              <summary>Program guide (EPG)</summary>
              <label for="epg-example">Optional starter guide</label>
              <select id="epg-example">
                <option value="">Custom / provider guide</option>
                <option value="https://raw.githubusercontent.com/matthuisman/i.mjh.nz/refs/heads/master/PlutoTV/gb.xml.gz">Pluto TV · UK feed</option>
                <option value="https://raw.githubusercontent.com/matthuisman/i.mjh.nz/refs/heads/master/PlutoTV/us.xml.gz">Pluto TV · US feed</option>
                <option value="https://raw.githubusercontent.com/matthuisman/i.mjh.nz/refs/heads/master/Plex/gb.xml.gz">Plex · UK feed</option>
              </select>
              <label for="epg-url">XMLTV guide URL</label>
              <input id="epg-url" type="url" placeholder="https://…/guide.xml.gz" autocomplete="off" />
              <button id="epg-refresh" type="button">Load / refresh guide</button>
              <label for="epg-file">Or import XML / XML.GZ (up to 20 MB)</label>
              <input id="epg-file" type="file" accept=".xml,.gz,application/xml,text/xml,application/gzip" />
              <button id="epg-clear" type="button">Remove guide</button>
              <p id="epg-status" role="status">Choose a starter guide or use your provider’s XMLTV URL. Match the channel’s provider and region; coverage varies. Times use your device timezone.</p>
            </details>
            <details class="playlist-access">
              <summary>Playlist links</summary>
              <div id="playlist-link-list" class="playlist-link-list"></div>
              <p id="playlist-action-status" class="playlist-action-status" role="status"></p>
              <div id="compatible-player-list" class="compatible-player-list"></div>
            </details>
            <div class="menu-update-control">
              <button id="check-update-button" class="menu-update-button" type="button" hidden>
                Check for updates
              </button>
              <p id="update-status" class="menu-update-status" role="status" hidden></p>
            </div>
            </div>
          </div>
        </details>
        <div class="app-title">
          <p class="menu-kicker">Player</p>
          <img class="app-brand-logo" src="assets/branding/rugare-tv-logo.png" alt="${APP_NAME}" />
          <span class="version-pill">v${APP_VERSION}</span>
        </div>
      </header>
      <section class="channel-browser-header" aria-label="Channel browser">
        <div class="channel-list-heading">
          <div>
            <span class="channel-list-kicker">Browse</span>
            <strong id="channel-list-title">All channels</strong>
            <button id="favorite-sort" type="button" hidden></button>
            <button id="browse-now-playing" type="button" hidden></button>
          </div>
          <span id="channel-count" class="channel-count">0</span>
        </div>
        <div class="channel-tools">
          <nav id="channel-featured-service-list" class="channel-featured-service-list" aria-label="Official TV services"></nav>
          <button id="search-toggle" class="channel-search-toggle" type="button" aria-label="Search channels" aria-expanded="false"></button>
        </div>
        <div id="channel-search" class="channel-search" hidden>
          <input
            type="search"
            id="search-box"
            aria-label="Search channels"
            placeholder="Search channels..."
            autocomplete="off"
            enterkeyhint="search"
          />
          <button id="search-clear" class="channel-search-clear" type="button" aria-label="Clear search" hidden>&times;</button>
        </div>
        <div id="category-strip" class="category-strip" aria-label="Subcategories"></div>
      </section>
      <ul id="channel-list" tabindex="-1"></ul>
    </aside>
    <section class="tv-only tv-apps-panel" aria-label="Official TV Apps">
      <button class="mobile-menu-back" type="button" aria-label="Back">‹</button><h2>Official TV Apps</h2>
      <nav id="tv-app-list" aria-label="TV apps"></nav>
    </section>
    <section class="tv-only tv-countries-panel"><button class="mobile-menu-back" type="button" aria-label="Back">‹</button><h2>Countries</h2><nav id="tv-country-list"></nav></section>
  `;

  const searchBox = root.querySelector('#search-box');
  const channelSearch = root.querySelector('#channel-search');
  const searchToggleButton = root.querySelector('#search-toggle');
  const searchClearButton = root.querySelector('#search-clear');
  const themeSelect = root.querySelector('#theme-select');
  const checkUpdateButton = root.querySelector('#check-update-button');
  const updateStatus = root.querySelector('#update-status');
  const countrySelect = root.querySelector('#country-filter');
  const categorySelect = root.querySelector('#category-filter');
  const hideBlockedToggle = root.querySelector('#hide-blocked-toggle');
  const favoritesToggle = root.querySelector('#favorites-toggle');
  const overflowMenu = root.querySelector('#overflow-menu');
  const overflowMenuButton = root.querySelector('.overflow-menu-button');
  const menuCloseButton = root.querySelector('.menu-close-button');
  root.querySelector('#tv-exit-button').hidden = typeof window.AndroidDevice?.exitApp !== 'function';
  root.querySelector('#tv-exit-button').addEventListener('click', () => window.AndroidDevice?.exitApp?.());
  root.querySelector('#tv-countries-button').addEventListener('click', () => isPanelMode() ? onBrowseSelection?.('countries') : openMenuPanel('countries'));
  root.querySelector('#tv-settings-button').addEventListener('click', () => isPanelMode() ? onSettingsSelection?.() : openMenuPanel('preferences'));
  root.querySelectorAll('.mobile-menu-back').forEach(button => button.addEventListener('click', () => onBack?.()));
  const playlistLinkList = root.querySelector('#playlist-link-list');
  const playlistActionStatus = root.querySelector('#playlist-action-status');
  const compatiblePlayerList = root.querySelector('#compatible-player-list');
  const categoryStrip = root.querySelector('#category-strip');

  const mediaSection = 'live';
  const qualitySelect = root.querySelector('#quality-select');
  qualitySelect.value = qualityApi?.get() || 'auto';
  const qualityButton = root.querySelector('#tv-quality-button');
  const qualityOptions = root.querySelector('#tv-quality-options');
  const qualityValue = root.querySelector('#tv-quality-value');
  function syncQualityValue() { qualityValue.textContent = qualitySelect.value === 'data-saver' ? 'Data saver' : 'Auto'; }
  syncQualityValue();
  qualityButton.setAttribute('aria-expanded', 'false');
  qualityButton.addEventListener('click', () => {
    qualityOptions.hidden = !qualityOptions.hidden;
    qualityButton.setAttribute('aria-expanded', String(!qualityOptions.hidden));
    if (!qualityOptions.hidden) qualityOptions.querySelector(`[data-quality="${qualitySelect.value}"]`)?.focus();
  });
  for (const option of qualityOptions.querySelectorAll('button')) option.addEventListener('click', () => {
    qualitySelect.value = option.dataset.quality;
    qualityApi?.set(qualitySelect.value);
    syncQualityValue();
    qualityOptions.hidden = true;
    qualityButton.setAttribute('aria-expanded', 'false');
    qualityButton.focus();
  });
  function closeQualityOptions() {
    if (qualityOptions.hidden) return false;
    qualityOptions.hidden = true;
    qualityButton.setAttribute('aria-expanded', 'false');
    qualityButton.focus();
    return true;
  }
  qualitySelect.addEventListener('change', () => { qualityApi?.set(qualitySelect.value); syncQualityValue(); });
  const channelListTitle = root.querySelector('#channel-list-title');
  const favoriteSort = root.querySelector('#favorite-sort');
  const browseNowPlaying = root.querySelector('#browse-now-playing');
  favoriteSort.addEventListener('click', () => {
    const modes = ['az', 'za', 'saved'];
    favoritesApi.setSort(modes[(modes.indexOf(favoritesApi.getSort()) + 1) % modes.length]);
    applyFilters();
    favoriteSort.focus({ preventScroll: true });
  });
  browseNowPlaying.addEventListener('click', () => {
    searchBox.value = ''; countrySelect.value = ''; categorySelect.value = '';
    favoritesToggle.checked = false;
    applyFilters();
    scrollToChannel(nowPlayingUrl);
    onBrowseSelection?.('channels');
  });
  const channelCount = root.querySelector('#channel-count');
  const listEl = root.querySelector('#channel-list');
  function isPanelMode() { return document.documentElement.classList.contains('tv-mode'); }
  if (isPanelMode()) {
    qualitySelect.options[0].textContent = 'Auto';
    qualitySelect.options[1].textContent = 'Data saver';
  }
  let nowPlayingUrl = null;
  let lastFocusedChannelUrl = null;
  let visibleChannels = [];
  let filteredChannels = [];
  const initialRenderLimit = isPanelMode() ? 100 : MAX_RENDERED_CHANNELS;
  let renderLimit = initialRenderLimit;
  const browsePositions = new Map();
  const favoriteButtons = new Map();
  const sortedChannels = sortChannelsAlphabetically(channels);
  let activeBrowseKey = null;
  listEl.addEventListener('focusin', (event) => {
    const url = event.target.closest('.channel-item')?.dataset.channelUrl;
    if (url) lastFocusedChannelUrl = url;
  });
  let scrollLoadScheduled = false;
  listEl.addEventListener('scroll', () => {
    if (scrollLoadScheduled || listEl.scrollHeight - listEl.clientHeight - listEl.scrollTop > 200) return;
    scrollLoadScheduled = true;
    window.requestAnimationFrame(() => {
      scrollLoadScheduled = false;
      if (listEl.scrollHeight - listEl.clientHeight - listEl.scrollTop <= 200) appendNextChannels();
    });
  }, { passive: true });

  let canCheckForUpdates = false;
  try {
    canCheckForUpdates = supportsNativeUpdates(window.AndroidDevice);
  } catch {
    canCheckForUpdates = false;
  }
  checkUpdateButton.hidden = !canCheckForUpdates;

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

  const countryList = root.querySelector('#tv-country-list');
  for (const option of countrySelect.options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = option.textContent;
    button.dataset.country = option.value;
    button.addEventListener('click', () => {
      countrySelect.value = option.value;
      applyFilters();
      if (isPanelMode()) onBrowseSelection?.('browse');
      else setMenuOpen(false);
    });
    countryList.appendChild(button);
  }
  function focusCountry() {
    const buttons = [...countryList.querySelectorAll('button')];
    (buttons.find(button => button.dataset.country === countrySelect.value) || buttons[0])?.focus();
  }
  function moveCountryFocus(direction) {
    const buttons = [...countryList.querySelectorAll('button')];
    const index = getBoundedFocusIndex(buttons.length, buttons.indexOf(document.activeElement), direction);
    buttons[index]?.focus();
    buttons[index]?.scrollIntoView({ block: 'nearest' });
    return true;
  }
  let categories = [];
  function updateCategories() {
    const available = new Set(channels.filter((channel) => getMediaSection(channel) === mediaSection)
      .map((channel) => getContentCategory(channel)));
    categories = mediaSection === 'live'
      ? CONTENT_CATEGORIES.filter((category) => available.has(category)) : [...available].sort();
    categorySelect.replaceChildren();
    const all = document.createElement('option');
    all.value = '';
    all.textContent = 'All subcategories';
    categorySelect.appendChild(all);
    for (const category of categories) {
      const opt = document.createElement('option');
      opt.value = category;
      opt.textContent = category;
      categorySelect.appendChild(opt);
    }
    renderCategoryStrip();
  }
  updateCategories();

  if (playlistAccessApi) {
    renderPlaylistAccess();
  }

  function applyFilters({ relaxCountryWhenCategoryEmpty = false, keepRenderLimit = false } = {}) {
    if (activeBrowseKey !== null) {
      browsePositions.set(activeBrowseKey, {
        renderLimit, scrollTop: listEl.scrollTop, url: lastFocusedChannelUrl,
      });
    }
    const listHadFocus = listEl.contains(document.activeElement);
    const filters = {
      mediaSection,
      search: searchBox.value,
      country: countrySelect.value,
      category: categorySelect.value,
      hideGeoBlocked: hideBlockedToggle.checked,
      favoritesOnly: favoritesToggle.checked,
      isFavorite: (url) => favoritesApi.isFavorite(url),
    };

    let filtered = filterChannelsForUi(sortedChannels, filters);
    if (
      relaxCountryWhenCategoryEmpty
      && filters.country
      && filters.category
      && filtered.length === 0
    ) {
      const categoryFiltered = filterChannelsForUi(sortedChannels, { ...filters, country: '' });
      if (categoryFiltered.length > 0) {
        countrySelect.value = '';
        filtered = categoryFiltered;
      }
    }

    const nextBrowseKey = JSON.stringify([
      mediaSection, filters.search, countrySelect.value, filters.category,
      filters.hideGeoBlocked, filters.favoritesOnly,
    ]);
    const position = browsePositions.get(nextBrowseKey);
    if (!keepRenderLimit) renderLimit = position?.renderLimit || initialRenderLimit;
    lastFocusedChannelUrl = position?.url || null;
    activeBrowseKey = nextBrowseKey;
    if (filters.favoritesOnly) {
      const sort = favoritesApi.getSort();
      if (sort === 'za') filtered.reverse();
      if (sort === 'saved') {
        const order = new Map(favoritesApi.order().map((url, index) => [url, index]));
        filtered.sort((a, b) => order.get(a.url) - order.get(b.url));
      }
    }
    favoriteSort.hidden = !filters.favoritesOnly;
    favoriteSort.textContent = `Sort: ${{ az: 'A–Z', za: 'Z–A', saved: 'My order' }[favoritesApi.getSort()]}`;
    favoriteSort.title = 'Change Favorites order: A–Z, Z–A, My order';
    filteredChannels = filtered;
    visibleChannels = limitChannelsForRendering(filteredChannels, renderLimit);
    searchClearButton.hidden = !filters.search.trim();
    syncCategoryStrip();
    channelListTitle.textContent = filters.search.trim()
      ? 'Search results'
      : filters.category || (filters.favoritesOnly ? 'Favorites' : { live: 'Live Channels', movie: 'Movies', show: 'Shows' }[mediaSection]);
    channelCount.textContent = visibleChannels.length < filtered.length
      ? `${visibleChannels.length} of ${filtered.length}`
      : String(filtered.length);
    renderList(visibleChannels);
    listEl.scrollTop = position?.scrollTop || 0;
    if (listHadFocus && lastFocusedChannelUrl) focusChannel(lastFocusedChannelUrl);
    onVisibleChannelsChange?.(visibleChannels);
  }

  function setSearchOpen(isOpen, { focus = false, clear = false } = {}) {
    if (clear && searchBox.value) {
      searchBox.value = '';
      applyFilters();
    }
    channelSearch.hidden = !isOpen;
    searchToggleButton.setAttribute('aria-expanded', String(isOpen));
    searchToggleButton.setAttribute('aria-label', isOpen ? 'Close channel search' : 'Search channels');
    if (isOpen && focus) searchBox.focus({ preventScroll: true });
  }

  function renderList(list, { append = false } = {}) {
    if (!append) {
      favoriteButtons.clear();
      listEl.innerHTML = '';
    }
    if (list.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'empty-state';
      emptyItem.textContent = favoritesToggle.checked
        ? 'No favorites yet. Choose All, then press Right and OK on a channel star to save it.'
        : channels.some((channel) => getMediaSection(channel) === mediaSection)
        ? 'No titles match these filters.'
        : `No ${mediaSection === 'movie' ? 'on-demand movies' : mediaSection === 'show' ? 'shows' : 'live channels'} are supplied by the current playlist.`;
      listEl.appendChild(emptyItem);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const channel of list) {
      const item = document.createElement('li');
      item.className = 'channel-item';
      item.dataset.channelUrl = channel.url;
      item.classList.toggle('now-playing', channel.url === nowPlayingUrl);
      item.setAttribute('aria-current', String(channel.url === nowPlayingUrl));

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
      favoriteButtons.set(channel.url, { button: favButton, channel });
      updateFavoriteButton(channel, favButton);
      favButton.addEventListener('click', (event) => {
        event.stopPropagation();
        favoritesApi.toggle(channel.url);
        refreshFavorites(channel.url);
      });

      item.appendChild(favButton);
      if (favoritesToggle.checked && favoritesApi.getSort() === 'saved') {
        for (const [direction, glyph, label] of [[-1, '↑', 'Move up'], [1, '↓', 'Move down']]) {
          const move = document.createElement('button');
          move.type = 'button'; move.className = 'favorite-move'; move.textContent = glyph;
          move.setAttribute('aria-label', `${label}: ${channel.name}`);
          const order = favoritesApi.order();
          const position = order.indexOf(channel.url);
          move.disabled = direction < 0 ? position === 0 : position === order.length - 1;
          move.addEventListener('click', () => {
            favoritesApi.move(channel.url, direction);
            applyFilters(); focusChannel(channel.url);
          });
          item.appendChild(move);
        }
      }
      selectButton.addEventListener('click', () => {
        if (searchBox.value.trim()) {
          searchBox.value = '';
          setSearchOpen(false);
          applyFilters();
        }
        setNowPlaying(channel.url);
        onSelectChannel(channel);
      });
      fragment.appendChild(item);
    }
    listEl.appendChild(fragment);
  }

  function appendNextChannels() {
    const previousLength = visibleChannels.length;
    if (previousLength >= filteredChannels.length) return false;
    renderLimit = Math.min(previousLength + (isPanelMode() ? 50 : 100), filteredChannels.length);
    visibleChannels = limitChannelsForRendering(filteredChannels, renderLimit);
    renderList(visibleChannels.slice(previousLength), { append: true });
    channelCount.textContent = visibleChannels.length < filteredChannels.length
      ? `${visibleChannels.length} of ${filteredChannels.length}` : String(filteredChannels.length);
    onVisibleChannelsChange?.(visibleChannels);
    return true;
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
    const back = document.createElement('button');
    back.className = 'mobile-category-back';
    back.type = 'button';
    back.textContent = '‹';
    back.setAttribute('aria-label', 'Back');
    back.addEventListener('click', () => onBack?.());
    categoryStrip.appendChild(back);
    for (const category of ['apps', '', 'favorites', ...categories]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'category-chip';
      button.dataset.category = category;
      button.textContent = category === 'apps' ? 'Official TV Apps' : category === 'favorites' ? 'Favorites' : category || 'All Channels';
      button.addEventListener('click', () => {
        if (category === 'apps') {
          if (isPanelMode()) onBrowseSelection?.('apps');
          else openMenuPanel('apps');
          return;
        }
        if (category === 'favorites') {
          searchBox.value = '';
          setSearchOpen(false);
          countrySelect.value = '';
          categorySelect.value = '';
          favoritesToggle.checked = true;
          applyFilters();
          onBrowseSelection?.('channels');
          return;
        }
        if (!category) {
          searchBox.value = '';
          setSearchOpen(false);
          if (!isPanelMode()) countrySelect.value = '';
          categorySelect.value = '';
          favoritesToggle.checked = false;
          applyFilters();
          onBrowseSelection?.('channels');
          return;
        }
        categorySelect.value = category;
        favoritesToggle.checked = false;
        applyFilters({ relaxCountryWhenCategoryEmpty: true });
        onBrowseSelection?.('channels');
      });
      categoryStrip.appendChild(button);
    }
  }

  function syncCategoryStrip() {
    for (const button of categoryStrip.querySelectorAll('.category-chip')) {
      const selected = button.dataset.category === 'apps' ? false : button.dataset.category === 'favorites'
        ? favoritesToggle.checked
        : !favoritesToggle.checked && button.dataset.category === categorySelect.value;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
  }

  function setNowPlaying(url) {
    nowPlayingUrl = url;
    browseNowPlaying.hidden = !url;
    const channel = channels.find((item) => item.url === url);
    browseNowPlaying.textContent = channel ? `▶ ${channel.name}` : '';
    browseNowPlaying.setAttribute('aria-label', `Show playing channel: ${channel?.name || ''}`);
    updateNowPlayingMarkers();
  }

  function setMenuOpen(isOpen) {
    if (!isPanelMode()) {
      if (isOpen && !overflowMenu.open) document.documentElement.dataset.menuPanel = 'settings';
      if (!isOpen) delete document.documentElement.dataset.menuPanel;
    }
    overflowMenu.open = Boolean(isOpen);
  }
  function openMenuPanel(panel) {
    setMenuOpen(true);
    document.documentElement.dataset.menuPanel = panel;
  }
  function closeMenuPanel() {
    if (isPanelMode()) return false;
    if (!overflowMenu.open) { openMenuPanel('browse'); return true; }
    if (closeQualityOptions()) return true;
    const panel = document.documentElement.dataset.menuPanel;
    if (panel === 'preferences' || panel === 'countries' || panel === 'browse') document.documentElement.dataset.menuPanel = 'settings';
    else setMenuOpen(false);
    return true;
  }

  function ensureChannelRendered(url) {
    const index = filteredChannels.findIndex((channel) => channel.url === url);
    if (index >= renderLimit) {
      renderLimit = index + 1;
      visibleChannels = limitChannelsForRendering(filteredChannels, renderLimit);
      renderList(visibleChannels);
      onVisibleChannelsChange?.(visibleChannels);
    }
  }
  function focusChannel(url = nowPlayingUrl || lastFocusedChannelUrl) {
    ensureChannelRendered(url);
    const items = [...listEl.querySelectorAll('.channel-item')];
    const target = items.find((item) => item.dataset.channelUrl === url) || items[0];
    const button = target?.querySelector('.channel-select-button');
    if (!button) {
      listEl.focus({ preventScroll: true });
      return false;
    }
    lastFocusedChannelUrl = target.dataset.channelUrl || null;
    button.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'nearest' });
    return true;
  }

  function scrollToChannel(url = nowPlayingUrl) {
    ensureChannelRendered(url);
    const target = [...listEl.querySelectorAll('.channel-item')]
      .find((item) => item.dataset.channelUrl === url);
    if (!target) return false;
    listEl.scrollTop = Math.max(0, target.offsetTop - listEl.offsetTop);
    return true;
  }

  function moveChannelFocus(direction) {
    let buttons = [...listEl.querySelectorAll('.channel-select-button')];
    const favoriteFocused = document.activeElement?.classList.contains('favorite-btn');
    const row = document.activeElement?.closest('.channel-item');
    const currentIndex = buttons.indexOf(row?.querySelector('.channel-select-button'));
    if (!buttons.length) return false;
    if (direction < 0 && currentIndex === 0 && !favoriteSort.hidden) {
      favoriteSort.focus({ preventScroll: true }); return true;
    }
    if (direction > 0 && currentIndex === buttons.length - 1 && appendNextChannels()) {
      buttons = [...listEl.querySelectorAll('.channel-select-button')];
    }
    const nextIndex = getBoundedFocusIndex(buttons.length, currentIndex, direction);
    const button = favoriteFocused
      ? buttons[nextIndex].closest('.channel-item').querySelector('.favorite-btn') : buttons[nextIndex];
    lastFocusedChannelUrl = button.closest('.channel-item')?.dataset.channelUrl || null;
    button.focus({ preventScroll: true });
    button.closest('.channel-item')?.scrollIntoView({ block: 'nearest' });
    return true;
  }

  function updateFavoriteButton(channel, button) {
    const favorite = favoritesApi.isFavorite(channel.url);
    button.textContent = favorite ? '★' : '☆';
    button.setAttribute('aria-label', `${favorite ? 'Remove' : 'Add'} ${channel.name} ${favorite ? 'from' : 'to'} favorites`);
    button.setAttribute('aria-pressed', String(favorite));
  }

  function refreshFavorites(changedUrl) {
    if (!favoritesToggle.checked) {
      const entry = favoriteButtons.get(changedUrl);
      if (entry) updateFavoriteButton(entry.channel, entry.button);
      else if (!changedUrl) {
        for (const { channel, button } of favoriteButtons.values()) updateFavoriteButton(channel, button);
      }
    } else {
      const focusedUrl = document.activeElement?.closest('.channel-item')?.dataset.channelUrl;
      const hadStarFocus = document.activeElement?.classList.contains('favorite-btn');
      const rowIndex = visibleChannels.findIndex((channel) => channel.url === focusedUrl);
      applyFilters({ keepRenderLimit: true });
      if (focusedUrl) {
        const url = visibleChannels.some((channel) => channel.url === focusedUrl)
          ? focusedUrl : visibleChannels[Math.min(rowIndex, visibleChannels.length - 1)]?.url;
        if (url) {
          focusChannel(url);
          if (hadStarFocus) moveChannelActionFocus('right');
        } else focusCategory();
      }
    }
    onFavoriteChange?.();
  }

  function moveChannelActionFocus(direction) {
    const row = document.activeElement?.closest('.channel-item');
    if (!row) return false;
    const actions = [...row.querySelectorAll('button:not(:disabled)')];
    const index = actions.indexOf(document.activeElement);
    const next = index + (direction === 'right' ? 1 : -1);
    if (next >= 0 && next < actions.length) {
      actions[next].focus({ preventScroll: true });
      return true;
    }
    return false;
  }

  function getCategoryButtons() {
    return [...categoryStrip.querySelectorAll('.category-chip')];
  }

  function focusCategory() {
    const buttons = getCategoryButtons();
    const target = buttons.find((button) => button.classList.contains('selected')) || buttons[0];
    if (!target) return false;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return true;
  }

  function moveCategoryFocus(direction) {
    const buttons = getCategoryButtons();
    if (!buttons.length) return false;
    const currentIndex = buttons.indexOf(document.activeElement);
    const nextIndex = getWrappedFocusIndex(buttons.length, currentIndex, direction);
    const target = buttons[nextIndex];
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return true;
  }

  function isFirstChannelFocused() {
    const firstButton = listEl.querySelector('.channel-select-button');
    return Boolean(firstButton && firstButton.closest('.channel-item').contains(document.activeElement));
  }

  function getChannelServiceLinks() {
    const selector = document.documentElement.dataset.tvPanel === 'apps'
      ? '#tv-app-list .featured-service-link' : '#channel-featured-service-list .featured-service-link';
    return [...root.querySelectorAll(selector)];
  }

  function focusChannelService(index = 0) {
    const links = getChannelServiceLinks();
    const target = links[index] || links[0];
    if (!target) return false;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return true;
  }

  function moveChannelServiceFocus(direction) {
    const links = getChannelServiceLinks();
    if (!links.length) return false;
    const currentIndex = links.indexOf(document.activeElement);
    const nextIndex = getBoundedFocusIndex(links.length, currentIndex, direction);
    return focusChannelService(nextIndex);
  }

  function getMenuFocusables() {
    return [...root.querySelectorAll(
      '.overflow-menu-panel button, .overflow-menu-panel input, .overflow-menu-panel select, '
      + '.overflow-menu-panel summary, .overflow-menu-panel a',
    )].filter((element) => !element.disabled && element.getClientRects().length > 0);
  }

  function focusMenu() {
    const target = document.documentElement.dataset.tvPanel === 'preferences'
      ? hideBlockedToggle : isPanelMode() ? root.querySelector('#tv-countries-button') : countrySelect;
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

    const privatePlaylist = playlistAccessApi.privatePlaylist;
    if (privatePlaylist) {
      const privateInfo = privatePlaylist.getInfo();
      const row = document.createElement('section');
      row.className = 'playlist-link-row';

      const text = document.createElement('div');
      text.className = 'playlist-link-text';

      const name = document.createElement('strong');
      name.textContent = privateInfo ? `Private M3U: ${privateInfo.name}` : 'Private local M3U';

      const description = document.createElement('span');
      description.textContent = privateInfo
        ? `${privateInfo.channelCount} channels stored only inside this Android app.`
        : 'Import a local playlist without publishing its URLs or account details.';
      text.append(name, description);

      const actions = document.createElement('div');
      actions.className = 'playlist-actions';

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.m3u,.m3u8,audio/x-mpegurl,application/vnd.apple.mpegurl,text/plain';
      fileInput.hidden = true;

      const importButton = document.createElement('button');
      importButton.type = 'button';
      importButton.className = 'playlist-action primary';
      importButton.textContent = privateInfo ? 'Replace private M3U' : 'Import private M3U';
      importButton.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', async () => {
        const [file] = fileInput.files || [];
        if (!file) return;
        importButton.disabled = true;
        setPlaylistStatus(`Checking ${file.name}…`);
        try {
          const imported = await privatePlaylist.importFile(file);
          setPlaylistStatus(`Imported ${imported.channelCount} channels from ${imported.name}.`);
          privatePlaylist.reload();
        } catch (err) {
          setPlaylistStatus(`Import failed: ${err.message}`);
          fileInput.value = '';
          importButton.disabled = false;
        }
      });

      actions.append(importButton, fileInput);

      if (privateInfo) {
        const restoreButton = document.createElement('button');
        restoreButton.type = 'button';
        restoreButton.className = 'playlist-action';
        restoreButton.textContent = 'Use curated list';
        restoreButton.addEventListener('click', () => {
          privatePlaylist.clear();
          privatePlaylist.reload();
        });
        actions.appendChild(restoreButton);
      }

      row.append(text, actions);
      playlistLinkList.appendChild(row);
    }

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

  function setUpdateStatus(message) {
    const nextMessage = String(message || '').trim();
    updateStatus.textContent = nextMessage;
    updateStatus.hidden = !nextMessage;
  }

  root.addEventListener('click', (event) => {
    const inAppLink = event.target.closest?.('a[data-in-app-browser="true"]');
    if (inAppLink && typeof window.AndroidDevice?.openOfficialUrl === 'function') {
      event.preventDefault();
      window.AndroidDevice.openOfficialUrl(inAppLink.href);
    }
    if (!isPanelMode() && !overflowMenu.contains(event.target) && !event.target.closest('.tv-countries-panel, .tv-apps-panel, .category-strip')) setMenuOpen(false);
  });

  overflowMenu.addEventListener('toggle', () => {
    if (!isPanelMode()) {
      if (overflowMenu.open && !document.documentElement.dataset.menuPanel) document.documentElement.dataset.menuPanel = 'settings';
      if (!overflowMenu.open) delete document.documentElement.dataset.menuPanel;
    }
    overflowMenuButton.setAttribute(
      'aria-label',
      overflowMenu.open ? 'Close menu' : 'Open menu',
    );
    onMenuOpenChange?.(overflowMenu.open);
  });
  menuCloseButton.addEventListener('click', () => setMenuOpen(false));

  searchBox.addEventListener('input', () => applyFilters());
  searchBox.addEventListener('search', () => applyFilters());
  searchBox.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setSearchOpen(false, { clear: true });
      searchToggleButton.focus({ preventScroll: true });
      return;
    }
    if (event.key !== 'Enter') return;
    event.preventDefault();
    searchBox.blur();
    focusChannel();
  });
  searchClearButton.addEventListener('click', () => {
    searchBox.value = '';
    applyFilters();
    if (isPanelMode()) focusChannel();
    else {
      setSearchOpen(false);
      searchToggleButton.focus({ preventScroll: true });
    }
  });
  searchToggleButton.addEventListener('click', () => {
    if (channelSearch.hidden) {
      setSearchOpen(true, { focus: true });
    } else {
      setSearchOpen(false, { clear: true });
    }
  });
  themeSelect.value = themeApi.get();
  const themeButtons = [...root.querySelectorAll('[data-theme-choice]')];
  function syncThemeButtons() {
    for (const button of themeButtons) button.setAttribute('aria-pressed', String(button.dataset.themeChoice === themeApi.get()));
  }
  for (const button of themeButtons) button.addEventListener('click', () => {
    themeSelect.value = button.dataset.themeChoice;
    themeApi.set(themeSelect.value);
    syncThemeButtons();
  });
  syncThemeButtons();
  themeSelect.addEventListener('change', () => { themeApi.set(themeSelect.value); syncThemeButtons(); });
  checkUpdateButton.addEventListener('click', () => {
    if (!canCheckForUpdates) return;
    setUpdateStatus('Checking for updates…');
    try {
      window.AndroidDevice.checkForUpdate();
    } catch {
      setUpdateStatus('The update check could not start.');
    }
  });
  countrySelect.addEventListener('change', applyFilters);
  categorySelect.addEventListener('change', () => applyFilters({ relaxCountryWhenCategoryEmpty: true }));
  hideBlockedToggle.addEventListener('change', applyFilters);
  favoritesToggle.addEventListener('change', applyFilters);

  applyFilters();

  return {
    refresh: applyFilters,
    refreshFavorites,
    setNowPlaying,
    setMenuOpen,
    focusChannel,
    scrollToChannel,
    moveChannelFocus,
    moveChannelActionFocus,
    focusCategory,
    moveCategoryFocus,
    isFirstChannelFocused,
    focusChannelService,
    moveChannelServiceFocus,
    closeMenuPanel,
    closeQualityOptions,
    focusCountry,
    moveCountryFocus,
    focusMenu,
    moveMenuFocus,
    setUpdateStatus,
    getVisibleChannels: () => visibleChannels.slice(),
  };
}
