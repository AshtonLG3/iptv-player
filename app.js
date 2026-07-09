import { loadChannels } from './src/playlist.js';
import { renderApp } from './src/ui.js';
import { createPlayer } from './src/player.js';
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

  applyTheme(themeApi.get());

  let appView = null;
  const player = createPlayer(videoEl);
  player.onError((err) => {
    statusEl.textContent = `Can't play this channel: ${err.message}`;
    statusEl.hidden = false;
  });

  function selectChannel(channel) {
    statusEl.hidden = true;
    setLastWatched(window.localStorage, channel.url);
    appView?.setNowPlaying(channel.url);
    player.play(channel.url);
  }

  async function boot() {
    retryButton.hidden = true;
    root.textContent = 'Loading FTA channels...';

    try {
      const channels = await loadChannels({
        fetchImpl: window.fetch.bind(window),
        sessionStore: window.sessionStorage,
      });

      appView = renderApp({ root, channels, favoritesApi, themeApi, onSelectChannel: selectChannel });

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
  boot();
}

main();
