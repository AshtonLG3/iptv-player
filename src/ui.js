import { SADC_COUNTRIES } from './constants.js';

export function renderApp({ root, channels, favoritesApi, onSelectChannel }) {
  root.innerHTML = `
    <aside class="sidebar">
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
  const countrySelect = root.querySelector('#country-filter');
  const categorySelect = root.querySelector('#category-filter');
  const favoritesToggle = root.querySelector('#favorites-toggle');
  const listEl = root.querySelector('#channel-list');

  const countries = [...new Set(channels.map((c) => c.country))].sort();
  for (const code of countries) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = SADC_COUNTRIES[code] || code;
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
    for (const channel of list) {
      const item = document.createElement('li');
      item.className = 'channel-item';
      item.textContent = channel.name;

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
      item.addEventListener('click', () => onSelectChannel(channel));
      listEl.appendChild(item);
    }
  }

  searchBox.addEventListener('input', applyFilters);
  countrySelect.addEventListener('change', applyFilters);
  categorySelect.addEventListener('change', applyFilters);
  favoritesToggle.addEventListener('change', applyFilters);

  applyFilters();

  return { refresh: applyFilters };
}
