import { describePlaybackError, getMediaSection, getPlaybackSources } from './catalog.js?v=20261124a';
import { createPlayer } from './player.js?v=20261124a';

export function createMultiview({ bridge, isFavorite, onStart, onClose }) {
  const native = typeof bridge?.playMultiviewTile === 'function';
  const dialog = document.createElement('dialog');
  dialog.className = 'multiview';
  dialog.setAttribute('aria-labelledby', 'multiview-title');
  dialog.innerHTML = `
    <header class="multiview-header">
      <h2 id="multiview-title">Multiview</h2>
      <button type="button" data-edit hidden>Change channels</button>
      <button type="button" data-close>Close</button>
    </header>
    <section class="multiview-setup">
      <div class="multiview-controls">
        <div class="multiview-counts" role="group" aria-label="Number of channels">
          <button type="button" data-count="2">2 channels</button>
          <button type="button" data-count="3">3 channels</button>
          <button type="button" data-count="4">4 channels</button>
        </div>
        <button type="button" data-start></button>
      </div>
      <input type="search" placeholder="Search live channels" aria-label="Search live channels" />
      <div class="multiview-list" role="group" aria-label="Live channels"></div>
    </section>
    <section class="multiview-grid" aria-label="Playing channels" hidden></section>`;
  document.body.append(dialog);
  const setup = dialog.querySelector('.multiview-setup');
  const list = dialog.querySelector('.multiview-list');
  const grid = dialog.querySelector('.multiview-grid');
  const search = dialog.querySelector('input');
  const start = dialog.querySelector('[data-start]');
  const edit = dialog.querySelector('[data-edit]');
  const counts = [...dialog.querySelectorAll('[data-count]')];
  let channels = [];
  let selected = [];
  let tiles = [];
  let opener;
  let count = 2;
  let audible = 0;
  let expanded = null;
  let session = 0;
  let played = false;
  let suspended = false;

  function updateSelection() {
    for (const button of counts) button.setAttribute('aria-pressed', String(Number(button.dataset.count) === count));
    start.disabled = selected.length !== count;
    start.textContent = `Watch (${selected.length}/${count})`;
    for (const button of list.querySelectorAll('button')) {
      const picked = selected.includes(channels[Number(button.dataset.channel)]);
      button.setAttribute('aria-pressed', String(picked));
      button.setAttribute('aria-disabled', String(!picked && selected.length === count));
    }
  }

  function renderList() {
    const query = search.value.trim().toLowerCase();
    list.replaceChildren();
    const rows = document.createDocumentFragment();
    for (const [index, channel] of channels.entries()) {
      if (!`${channel.name} ${channel.country || ''}`.toLowerCase().includes(query)) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.channel = String(index);
      button.textContent = channel.name;
      rows.append(button);
    }
    if (!rows.childElementCount) rows.append('No matching live channels');
    list.append(rows);
    list.scrollTop = 0;
    updateSelection();
  }

  function open(catalog, currentChannel) {
    if (dialog.open) return;
    channels = [...new Map(catalog.filter((channel) => getMediaSection(channel) === 'live')
      .map((channel) => [channel.url, channel])).values()].sort((a, b) =>
      Number(b === currentChannel) - Number(a === currentChannel)
      || Number(isFavorite(b.url)) - Number(isFavorite(a.url)) || a.name.localeCompare(b.name));
    selected = channels.includes(currentChannel) ? [currentChannel] : [];
    count = 2;
    played = false;
    suspended = false;
    search.value = '';
    opener = document.activeElement;
    renderList();
    dialog.showModal();
    counts[0].focus();
  }

  function syncBounds() {
    if (!native || grid.hidden || suspended) return;
    bridge.setMultiviewBounds(JSON.stringify({ viewportWidth: window.innerWidth, tiles: tiles.map((tile) => {
      const { left, top, width, height } = tile.video.getBoundingClientRect();
      return { left, top, width, height };
    }) }));
  }

  function updateAudio() {
    if (native && !suspended) bridge.setMultiviewAudio(audible);
    for (const [index, tile] of tiles.entries()) {
      const active = index === audible;
      tile.video.muted = !active;
      tile.audio.setAttribute('aria-pressed', String(active));
      tile.audio.textContent = active ? 'Audio on' : 'Audio';
    }
  }

  function setExpanded(index) {
    expanded = index;
    grid.classList.toggle('multiview-expanded', index !== null);
    for (const [i, tile] of tiles.entries()) {
      tile.element.hidden = index !== null && index !== i;
      tile.expand.textContent = index === null ? 'Fullscreen' : 'Show grid';
    }
    syncBounds();
  }

  function playTile(index) {
    const tile = tiles[index];
    tile.status.textContent = 'Loading…';
    tile.retry.hidden = true;
    const sources = getPlaybackSources(tile.channel, 'data-saver');
    if (native) {
      tile.session = ++session;
      bridge.playMultiviewTile(index, JSON.stringify(sources), tile.channel.name, tile.session, index === audible);
      syncBounds();
    } else {
      tile.player.play(sources, { quality: 'data-saver', muted: index !== audible });
    }
  }

  function showError(tile, message) {
    tile.status.textContent = message;
    tile.retry.hidden = false;
    tile.player?.stop();
  }

  function makeTile(channel, index) {
    const element = document.createElement('article');
    element.className = 'multiview-tile';
    element.innerHTML = `
      <div class="multiview-picture">
        <video playsinline></video>
        <span class="multiview-status" role="status"></span>
      </div>
      <footer><strong></strong><button type="button" data-retry hidden>Retry</button>
        <button type="button" data-audio>Audio</button><button type="button" data-expand>Fullscreen</button></footer>`;
    element.querySelector('strong').textContent = channel.name;
    const video = element.querySelector('video');
    const tile = {
      channel, element, video,
      status: element.querySelector('.multiview-status'),
      retry: element.querySelector('[data-retry]'),
      audio: element.querySelector('[data-audio]'),
      expand: element.querySelector('[data-expand]'),
    };
    tile.audio.setAttribute('aria-label', `Audio for ${channel.name}`);
    tile.retry.addEventListener('click', () => { tile.audio.focus(); playTile(index); });
    tile.audio.addEventListener('click', () => { audible = index; updateAudio(); });
    tile.expand.addEventListener('click', () => {
      if (expanded === null) { audible = index; updateAudio(); }
      setExpanded(expanded === null ? index : null);
    });
    if (!native) {
      tile.player = createPlayer(video, { androidBridge: null, nativeEvents: null });
      tile.player.onError((error) => showError(tile, describePlaybackError(error, channel)));
      video.addEventListener('playing', () => { tile.status.textContent = ''; });
      video.addEventListener('ended', () => showError(tile, 'Stream ended'));
    }
    return tile;
  }

  function startGrid() {
    if (selected.length !== count) return;
    if (!played) onStart();
    played = true;
    setup.hidden = true;
    grid.hidden = edit.hidden = false;
    grid.dataset.count = String(count);
    audible = 0;
    tiles = selected.map(makeTile);
    grid.replaceChildren(...tiles.map((tile) => tile.element));
    dialog.classList.toggle('multiview-native', native);
    document.documentElement.classList.add('multiview-playing');
    setExpanded(null);
    updateAudio();
    tiles.forEach((_, index) => playTile(index));
    tiles[0].audio.focus();
  }

  function stopPlayback() {
    if (native) bridge.stopMultiview();
    for (const tile of tiles) {
      tile.session = null;
      tile.player?.destroy();
      tile.player = null;
    }
  }

  function showSetup() {
    stopPlayback();
    tiles = [];
    grid.replaceChildren();
    grid.hidden = edit.hidden = true;
    setup.hidden = false;
    expanded = null;
    document.documentElement.classList.remove('multiview-playing');
  }

  function close() {
    if (!dialog.open) return;
    if (!grid.hidden) showSetup();
    dialog.close();
    opener?.focus({ preventScroll: true });
    onClose(played);
  }

  function back() {
    if (expanded !== null) setExpanded(null);
    else close();
    return true;
  }

  function suspend() {
    if (!dialog.open || grid.hidden || suspended) return;
    suspended = true;
    if (native) stopPlayback();
    else for (const tile of tiles) tile.player.suspend();
  }

  function resume() {
    if (!dialog.open || grid.hidden || !suspended) return;
    suspended = false;
    updateAudio();
    tiles.forEach((_, index) => playTile(index));
  }

  function handleDirection(event, key) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return;
    const current = document.activeElement;
    const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
    if (horizontal && current === search) return;
    event.preventDefault();
    const candidates = [...dialog.querySelectorAll('button:not(:disabled), input')]
      .filter((button) => button.getClientRects().length);
    const direction = key === 'ArrowUp' || key === 'ArrowLeft' ? -1 : 1;
    const from = candidates.indexOf(current);
    let next;
    if (!setup.hidden) {
      const insideList = list.contains(current);
      if (insideList && horizontal) return;
      next = candidates[from + direction] || candidates[from];
    } else {
      const center = (button) => {
        const rect = button.getBoundingClientRect();
        return [rect.left + rect.width / 2, rect.top + rect.height / 2];
      };
      const [x, y] = center(current);
      let best = Infinity;
      for (const button of candidates) {
        const [cx, cy] = center(button);
        const forward = (horizontal ? cx - x : cy - y) * direction;
        const cross = Math.abs(horizontal ? cy - y : cx - x);
        const score = forward + cross * 4;
        if (forward > 4 && score < best) { best = score; next = button; }
      }
    }
    next?.focus({ preventScroll: true });
    next?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  for (const button of counts) button.addEventListener('click', () => {
    count = Number(button.dataset.count);
    selected = selected.slice(0, count);
    updateSelection();
  });
  list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-channel]');
    if (!button || button.getAttribute('aria-disabled') === 'true') return;
    const channel = channels[Number(button.dataset.channel)];
    if (selected.includes(channel)) selected = selected.filter((item) => item !== channel);
    else selected.push(channel);
    updateSelection();
    if (!start.disabled) start.focus();
  });
  search.addEventListener('input', renderList);
  start.addEventListener('click', startGrid);
  edit.addEventListener('click', () => { showSetup(); counts.find((button) => Number(button.dataset.count) === count).focus(); });
  dialog.querySelector('[data-close]').addEventListener('click', close);
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); back(); });
  window.addEventListener('resize', syncBounds);
  document.addEventListener('visibilitychange', () => document.hidden ? suspend() : resume());
  if (native) window.addEventListener('rugare-multiview-playback', ({ detail }) => {
    const tile = tiles[detail.tile];
    if (!tile || tile.session !== detail.session) return;
    if (detail.ended) showError(tile, 'Stream ended');
    else if (detail.error?.includes('DECODER_INIT_FAILED')) {
      showError(tile, 'The device could not start another decoder. Try a lower-resolution channel or fewer tiles.');
    } else if (detail.error) showError(tile, describePlaybackError(new Error(detail.error), tile.channel));
    else if (detail.ready) tile.status.textContent = '';
  });

  return { open, close, back, handleDirection, suspend, resume, isOpen: () => dialog.open };
}
