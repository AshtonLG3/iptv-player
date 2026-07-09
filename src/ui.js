import { APP_NAME, APP_VERSION, FTA_COUNTRIES } from './constants.js';

export function renderApp({ root, channels, favoritesApi, themeApi, onSelectChannel }) {
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
      <label class="favorites-label">
        <input type="checkbox" id="favorites-toggle" /> Favorites only
      </label>
      <ul id="channel-list"></ul>
    </aside>
  `;

  const searchBox = root.querySelector('#search-box');
  const themeSelect = root.querySelector('#theme-select');
  const countrySelect = root.querySelector('#country-filter');
  const categorySelect = root.querySelector('#category-filter');
  const favoritesToggle = root.querySelector('#favorites-toggle');
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

  function applyFilters() {
    const search = searchBox.value.trim().toLowerCase();
    const country = countrySelect.value;
    const category = categorySelect.value;
    const favoritesOnly = favoritesToggle.checked;

    const filtered = channels.filter((channel) => {
      if (search && !channel.name.toLowerCase().includes(search)) return false;
      if (country && channel.country !== country) return false;
      if (category && channel.category !== category) return false;
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

  searchBox.addEventListener('input', applyFilters);
  themeSelect.value = themeApi.get();
  themeSelect.addEventListener('change', () => themeApi.set(themeSelect.value));
  countrySelect.addEventListener('change', applyFilters);
  categorySelect.addEventListener('change', applyFilters);
  favoritesToggle.addEventListener('change', applyFilters);

  applyFilters();

  return { refresh: applyFilters, setNowPlaying };
}
