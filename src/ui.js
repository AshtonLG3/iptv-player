import { APP_NAME, APP_VERSION, FTA_COUNTRIES, OFFICIAL_SERVICES } from './constants.js';

function isGeoBlockedChannel(channel) {
  return /\[geo-blocked\]/i.test(channel.name);
}

function isIntermittentChannel(channel) {
  return /\[not 24\/7\]/i.test(channel.name);
}

export function renderApp({
  root,
  channels,
  favoritesApi,
  themeApi,
  playlistAccessApi = null,
  onSelectChannel,
}) {
  root.innerHTML = `
    <aside class="sidebar">
      <header class="app-menu">
        <div>
          <p class="menu-kicker">Player</p>
          <h1>${APP_NAME}</h1>
          <span class="version-pill">v${APP_VERSION}</span>
        </div>
        <label class="theme-control" for="theme-select">
          <span>Theme</span>
          <select id="theme-select">
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
      </header>
      <input type="search" id="search-box" placeholder="Search channels..." />
      <select id="country-filter"><option value="">All countries</option></select>
      <select id="category-filter"><option value="">All categories</option></select>
      <label class="blocked-label">
        <input type="checkbox" id="hide-blocked-toggle" checked /> Hide geo-blocked
      </label>
      <label class="favorites-label">
        <input type="checkbox" id="favorites-toggle" /> Favorites only
      </label>
      <details class="playlist-access">
        <summary>Playlist links</summary>
        <div id="playlist-link-list" class="playlist-link-list"></div>
        <p id="playlist-action-status" class="playlist-action-status" role="status"></p>
        <div id="compatible-player-list" class="compatible-player-list"></div>
      </details>
      <details class="official-services">
        <summary>Official sources</summary>
        <div id="official-service-list" class="official-service-list"></div>
      </details>
      <ul id="channel-list"></ul>
    </aside>
  `;

  const searchBox = root.querySelector('#search-box');
  const themeSelect = root.querySelector('#theme-select');
  const countrySelect = root.querySelector('#country-filter');
  const categorySelect = root.querySelector('#category-filter');
  const hideBlockedToggle = root.querySelector('#hide-blocked-toggle');
  const favoritesToggle = root.querySelector('#favorites-toggle');
  const playlistLinkList = root.querySelector('#playlist-link-list');
  const playlistActionStatus = root.querySelector('#playlist-action-status');
  const compatiblePlayerList = root.querySelector('#compatible-player-list');
  const officialServiceList = root.querySelector('#official-service-list');
  const listEl = root.querySelector('#channel-list');
  let nowPlayingUrl = null;

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

  const categories = [...new Set(channels.map((c) => c.category).filter(Boolean))].sort();
  for (const category of categories) {
    const opt = document.createElement('option');
    opt.value = category;
    opt.textContent = category;
    categorySelect.appendChild(opt);
  }

  for (const service of OFFICIAL_SERVICES) {
    const link = document.createElement('a');
    link.href = service.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'official-service-link';

    const name = document.createElement('span');
    name.className = 'official-service-name';
    name.textContent = service.name;

    const meta = document.createElement('span');
    meta.className = 'official-service-meta';
    meta.textContent = `${service.country} - ${service.note}`;

    link.append(name, meta);
    officialServiceList.appendChild(link);
  }

  if (playlistAccessApi) {
    renderPlaylistAccess();
  }

  function applyFilters() {
    const search = searchBox.value.trim().toLowerCase();
    const country = countrySelect.value;
    const category = categorySelect.value;
    const hideGeoBlocked = hideBlockedToggle.checked;
    const favoritesOnly = favoritesToggle.checked;

    const filtered = channels.filter((channel) => {
      if (search && !channel.name.toLowerCase().includes(search)) return false;
      if (country && channel.country !== country) return false;
      if (category && channel.category !== category) return false;
      if (hideGeoBlocked && isGeoBlockedChannel(channel)) return false;
      if (favoritesOnly && !favoritesApi.isFavorite(channel.url)) return false;
      return true;
    });

    renderList(filtered);
  }

  function renderList(list) {
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

      const name = document.createElement('span');
      name.className = 'channel-name';
      name.textContent = channel.name;

      const badge = document.createElement('span');
      badge.className = 'now-playing-badge';
      badge.textContent = 'Now playing';

      const meta = document.createElement('span');
      meta.className = 'channel-meta';
      meta.append(name, badge);

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

      item.appendChild(meta);

      const favButton = document.createElement('button');
      favButton.type = 'button';
      favButton.className = 'favorite-btn';
      favButton.textContent = favoritesApi.isFavorite(channel.url) ? '★' : '☆';
      favButton.addEventListener('click', (event) => {
        event.stopPropagation();
        favoritesApi.toggle(channel.url);
        applyFilters();
      });

      item.appendChild(favButton);
      item.addEventListener('click', () => {
        setNowPlaying(channel.url);
        onSelectChannel(channel);
      });
      listEl.appendChild(item);
    }

    updateNowPlayingMarkers();
  }

  function updateNowPlayingMarkers() {
    for (const item of listEl.querySelectorAll('.channel-item')) {
      const isPlaying = item.dataset.channelUrl === nowPlayingUrl;
      item.classList.toggle('now-playing', isPlaying);
      item.setAttribute('aria-current', isPlaying ? 'true' : 'false');
    }
  }

  function setNowPlaying(url) {
    nowPlayingUrl = url;
    updateNowPlayingMarkers();
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

  searchBox.addEventListener('input', applyFilters);
  themeSelect.value = themeApi.get();
  themeSelect.addEventListener('change', () => themeApi.set(themeSelect.value));
  countrySelect.addEventListener('change', applyFilters);
  categorySelect.addEventListener('change', applyFilters);
  hideBlockedToggle.addEventListener('change', applyFilters);
  favoritesToggle.addEventListener('change', applyFilters);

  applyFilters();

  return { refresh: applyFilters, setNowPlaying };
}
