import { describePlaybackError, getMediaSection, getPlaybackSources } from './catalog.js?v=20261125a';
import { createPlayer } from './player.js?v=20261125a';

const MAX_TILES = 4;

export function createMultiview({ bridge, video, isFavorite, onChoosePrimary, onDropPrimary, onPrimaryAudio, onResumePrimary, onLayoutChange, onClose }) {
  const native = typeof bridge?.stopMultiviewTile === 'function';
  const videoHome = video.parentNode;
  const videoAnchor = video.nextSibling;
  const dialog = document.createElement('dialog');
  dialog.className = native ? 'multiview multiview-native' : 'multiview';
  dialog.setAttribute('aria-label', 'Multiview');
  dialog.innerHTML = `
    <section class="multiview-grid" aria-label="Playing channels" hidden></section>
    <section class="multiview-setup" aria-labelledby="multiview-title" hidden>
      <header>
        <h2 id="multiview-title">Add a channel</h2>
        <button type="button" data-dismiss aria-label="Close channel list">Close</button>
      </header>
      <input type="search" placeholder="Search live channels" aria-label="Search live channels" />
      <div class="multiview-list" role="group" aria-label="Live channels"></div>
    </section>`;
  document.body.append(dialog);
  const grid = dialog.querySelector('.multiview-grid');
  const setup = dialog.querySelector('.multiview-setup');
  const list = dialog.querySelector('.multiview-list');
  const search = dialog.querySelector('input');
  let catalog = [];
  let primaryChannel = null;
  let tiles = [];
  let active = null;
  let expanded = null;
  let opener;
  let session = 0;
  let suspended = false;

  function syncBounds() {
    onLayoutChange();
    if (!native || grid.hidden || suspended) return;
    const positions = Array(MAX_TILES).fill(null);
    for (const tile of tiles) {
      if (tile.primary) continue;
      const { left, top, width, height } = tile.picture.getBoundingClientRect();
      positions[tile.slot] = { left, top, width, height };
    }
    bridge.setMultiviewBounds(JSON.stringify({ viewportWidth: window.innerWidth, tiles: positions }));
  }

  function syncAudio() {
    onPrimaryAudio(!active || active.primary);
    if (native && !suspended) bridge.setMultiviewAudio(active?.slot ?? -1);
    for (const tile of tiles) {
      if (tile.player) tile.picture.querySelector('video').muted = tile !== active;
    }
  }

  function setActive(tile) {
    if (active === tile) return;
    if (active) {
      closeControls();
      active.element.removeAttribute('data-active');
    }
    active = tile;
    if (active) active.element.setAttribute('data-active', '');
    syncAudio();
    if (tiles.length === 3) syncBounds();
  }

  function focusTile(tile) {
    tile?.select.focus({ preventScroll: true });
  }

  function closeControls(restoreFocus = false) {
    if (!active) return;
    active.actions.hidden = true;
    active.element.removeAttribute('data-controls');
    active.select.setAttribute('aria-expanded', 'false');
    if (restoreFocus) focusTile(active);
  }

  function openControls() {
    if (!active || !setup.hidden) return;
    active.actions.hidden = false;
    active.element.setAttribute('data-controls', '');
    active.select.setAttribute('aria-expanded', 'true');
    active.watchOnly.focus({ preventScroll: true });
  }

  function toggleControls() {
    if (active?.actions.hidden) openControls();
    else closeControls(true);
  }

  function renderList() {
    const query = search.value.trim().toLowerCase();
    const playing = new Set([primaryChannel?.url, ...tiles.map((tile) => tile.channel.url)]);
    const rows = document.createDocumentFragment();
    for (const channel of catalog) {
      if (playing.has(channel.url) || !`${channel.name} ${channel.category || ''} ${channel.country || ''}`.toLowerCase().includes(query)) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = channel.name;
      button.addEventListener('click', () => addChannel(channel));
      rows.append(button);
    }
    if (!rows.childElementCount) rows.append('No matching live channels');
    list.replaceChildren(rows);
    list.scrollTop = 0;
  }

  function openPicker() {
    if (tiles.length >= MAX_TILES) return;
    closeControls();
    search.value = '';
    renderList();
    setup.hidden = false;
    grid.inert = true;
    (list.querySelector('button') || search).focus({ preventScroll: true });
  }

  function open(channels, currentChannel) {
    if (dialog.open) return;
    catalog = [...new Map(channels.filter((channel) => getMediaSection(channel) === 'live')
      .map((channel) => [channel.url, channel])).values()].sort((a, b) =>
      Number(isFavorite(b.url)) - Number(isFavorite(a.url)) || a.name.localeCompare(b.name));
    primaryChannel = currentChannel && getMediaSection(currentChannel) === 'live' ? currentChannel : null;
    opener = document.activeElement;
    dialog.querySelector('h2').textContent = primaryChannel ? 'Add a channel' : 'Choose a live channel';
    dialog.showModal();
    openPicker();
  }

  function dismissPicker() {
    if (grid.hidden) { close(); return; }
    setup.hidden = true;
    grid.inert = false;
    focusTile(active);
  }

  function moveVideo(parent, anchor) {
    if (native) return;
    if (video.parentNode === parent && video.nextSibling === anchor) return;
    if (parent.moveBefore && video.isConnected && parent.isConnected) {
      parent.moveBefore(video, anchor);
    } else {
      const playing = !video.paused;
      parent.insertBefore(video, anchor);
      if (playing && video.paused) video.play().catch(() => {});
    }
  }

  function makeTile(channel, slot) {
    const element = document.createElement('article');
    element.className = 'multiview-tile';
    element.innerHTML = `
      <div class="multiview-picture">
        <span class="multiview-status" role="status"></span>
        <button class="multiview-tile-select" type="button" aria-expanded="false">
          <span class="multiview-tile-hint" aria-hidden="true">
            <span class="multiview-pointer-hint">Controls</span><span class="multiview-tv-hint">OK for controls</span>
          </span>
        </button>
      </div>
      <footer>
        <strong></strong>
        <div class="multiview-tile-actions" aria-label="Channel controls" hidden>
          <button type="button" data-watch-only>Watch only</button>
          <button type="button" data-expand>Fullscreen</button>
          <button type="button" data-add>Add channel</button>
          <button type="button" data-remove>Remove</button>
          <button type="button" data-retry hidden>Retry</button>
        </div>
      </footer>`;
    const tile = {
      channel, element, slot, primary: slot < 0,
      picture: element.querySelector('.multiview-picture'),
      status: element.querySelector('.multiview-status'),
      select: element.querySelector('.multiview-tile-select'),
      actions: element.querySelector('.multiview-tile-actions'),
      watchOnly: element.querySelector('[data-watch-only]'),
      retry: element.querySelector('[data-retry]'),
      add: element.querySelector('[data-add]'),
      expand: element.querySelector('[data-expand]'),
    };
    element.querySelector('strong').textContent = channel.name;
    tile.select.setAttribute('aria-label', channel.name);
    element.addEventListener('focusin', () => setActive(tile));
    tile.select.addEventListener('click', () => { setActive(tile); openControls(); });
    tile.watchOnly.addEventListener('click', () => close(tile.channel));
    tile.expand.addEventListener('click', () => showExpanded(expanded ? null : tile));
    tile.add.addEventListener('click', openPicker);
    tile.retry.addEventListener('click', () => { closeControls(true); playTile(tile); });
    element.querySelector('[data-remove]').addEventListener('click', () => removeTile(tile));
    if (!native && !tile.primary) {
      const media = document.createElement('video');
      media.playsInline = true;
      tile.picture.prepend(media);
      tile.player = createPlayer(media, { androidBridge: null, nativeEvents: null });
      tile.player.onError((error) => showError(tile, describePlaybackError(error, channel)));
      media.addEventListener('playing', () => { tile.status.textContent = ''; });
      media.addEventListener('ended', () => showError(tile, 'Stream ended'));
    }
    return tile;
  }

  function updateGrid() {
    grid.dataset.count = String(tiles.length);
    grid.classList.toggle('multiview-expanded', Boolean(expanded));
    for (const tile of tiles) {
      tile.element.hidden = Boolean(expanded && tile !== expanded);
      tile.expand.textContent = expanded ? 'Show grid' : 'Fullscreen';
      tile.add.hidden = tiles.length >= MAX_TILES;
    }
    syncBounds();
  }

  function showExpanded(tile) {
    closeControls();
    expanded = tile;
    updateGrid();
    focusTile(tile || active);
  }

  function addChannel(channel) {
    if (tiles.length >= MAX_TILES || channel.url === primaryChannel?.url || tiles.some((tile) => tile.channel.url === channel.url)) return;
    if (tiles.length === 0 && !primaryChannel) {
      primaryChannel = channel;
      onChoosePrimary(channel);
      dialog.querySelector('h2').textContent = 'Add a channel';
      openPicker();
      return;
    }
    if (tiles.length === 0) {
      const primary = makeTile(primaryChannel, -1);
      tiles.push(primary);
      grid.append(primary.element);
      moveVideo(primary.picture, primary.picture.firstChild);
      grid.hidden = false;
      document.documentElement.classList.add('multiview-playing');
    }
    const slot = Array.from({ length: MAX_TILES }, (_, index) => index)
      .find((index) => !tiles.some((tile) => tile.slot === index));
    const tile = makeTile(channel, slot);
    tiles.push(tile);
    grid.append(tile.element);
    expanded = null;
    setup.hidden = true;
    grid.inert = false;
    setActive(tile);
    updateGrid();
    playTile(tile);
    focusTile(tile);
  }

  function playTile(tile) {
    tile.status.textContent = 'Loading…';
    tile.retry.hidden = true;
    const sources = getPlaybackSources(tile.channel, 'data-saver');
    if (native) {
      tile.session = ++session;
      bridge.playMultiviewTile(tile.slot, JSON.stringify(sources), tile.channel.name, tile.session, tile === active);
      syncBounds();
    } else {
      tile.player.play(sources, { quality: 'data-saver', muted: tile !== active });
    }
  }

  function showError(tile, message) {
    tile.status.textContent = message;
    tile.retry.hidden = false;
    tile.player?.stop();
  }

  function removeTile(tile) {
    const remaining = tiles.filter((item) => item !== tile);
    if (remaining.length === 1) { close(remaining[0].channel); return; }
    const next = remaining[Math.min(tiles.indexOf(tile), remaining.length - 1)];
    if (tile.primary) {
      moveVideo(videoHome, videoAnchor);
      primaryChannel = null;
      onDropPrimary(next.channel);
    } else if (native) bridge.stopMultiviewTile(tile.slot);
    tile.player?.destroy();
    tiles = remaining;
    tile.element.remove();
    setActive(next);
    showExpanded(null);
  }

  function close(channel = primaryChannel || active?.channel) {
    if (!dialog.open) return;
    if (tiles.length) {
      if (native) bridge.stopMultiview();
      for (const tile of tiles) tile.player?.destroy();
      moveVideo(videoHome, videoAnchor);
      tiles = [];
      grid.replaceChildren();
      grid.hidden = true;
      document.documentElement.classList.remove('multiview-playing');
    }
    expanded = null;
    setActive(null);
    setup.hidden = true;
    suspended = false;
    dialog.close();
    syncBounds();
    opener?.focus({ preventScroll: true });
    if (channel && channel.url !== primaryChannel?.url) onChoosePrimary(channel);
    onClose();
  }

  function back() {
    if (!setup.hidden) dismissPicker();
    else if (active && !active.actions.hidden) closeControls(true);
    else if (expanded) showExpanded(null);
    else close();
    return true;
  }

  function suspend() {
    if (!dialog.open || suspended) return;
    suspended = true;
    if (native) bridge.stopMultiview();
    else for (const tile of tiles) tile.player?.suspend();
  }

  function resume() {
    if (!dialog.open || !suspended) return;
    suspended = false;
    if (primaryChannel) onResumePrimary();
    syncAudio();
    for (const tile of tiles) if (!tile.primary) playTile(tile);
  }

  function handleDirection(event, key) {
    const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
    if (!horizontal && !['ArrowUp', 'ArrowDown'].includes(key)) return;
    const current = document.activeElement;
    if (horizontal && current === search) return;
    event.preventDefault();
    const direction = key === 'ArrowUp' || key === 'ArrowLeft' ? -1 : 1;
    const move = (items) => {
      const target = items[items.indexOf(current) + direction];
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'nearest' });
    };
    if (!setup.hidden) {
      if (!horizontal) move([setup.querySelector('[data-dismiss]'), search, ...list.querySelectorAll('button')]);
      return;
    }
    if (!active) return;
    if (!active.actions.hidden) {
      move([...active.actions.querySelectorAll('button:not([hidden])')]);
      return;
    }
    const center = ({ picture }) => {
      const rect = picture.getBoundingClientRect();
      return [rect.left + rect.width / 2, rect.top + rect.height / 2];
    };
    const [x, y] = center(active);
    let best = Infinity;
    let next;
    for (const tile of tiles) {
      if (tile.element.hidden) continue;
      const [cx, cy] = center(tile);
      const forward = (horizontal ? cx - x : cy - y) * direction;
      const score = forward + Math.abs(horizontal ? cy - y : cx - x) * 4;
      if (forward > 4 && score < best) { best = score; next = tile; }
    }
    if (next) focusTile(next);
    else if (key === 'ArrowUp' && !event.repeat) openPicker();
  }

  search.addEventListener('input', renderList);
  setup.querySelector('[data-dismiss]').addEventListener('click', dismissPicker);
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); back(); });
  window.addEventListener('resize', syncBounds);
  document.addEventListener('visibilitychange', () => document.hidden ? suspend() : resume());
  if (native) window.addEventListener('rugare-multiview-playback', ({ detail }) => {
    const tile = tiles.find((item) => item.slot === detail.tile && item.session === detail.session);
    if (!tile || suspended) return;
    if (detail.ended) showError(tile, 'Stream ended');
    else if (detail.error?.includes('DECODER_INIT_FAILED')) {
      showError(tile, 'The device could not start another decoder. Try a lower-resolution channel or fewer tiles.');
    } else if (detail.error) showError(tile, describePlaybackError(new Error(detail.error), tile.channel));
    else if (detail.ready) tile.status.textContent = '';
  });

  return {
    open, close, back, toggleControls, handleDirection, suspend, resume, isOpen: () => dialog.open,
    primaryBounds: () => tiles.find((tile) => tile.primary)?.picture.getBoundingClientRect(),
    isPrimaryAudible: () => !active || active.primary,
  };
}
