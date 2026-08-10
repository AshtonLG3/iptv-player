import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

class FakeElement {
  constructor(documentObj, {
    tagName = 'DIV',
    rect,
    text = '',
    parent = null,
    onClick = null,
  } = {}) {
    this.documentObj = documentObj;
    this.tagName = tagName;
    this.rect = rect || { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    this.textContent = text;
    this.parentElement = parent;
    this.children = [];
    this.attributes = new Map();
    this.classes = new Set();
    this.classList = {
      add: (name) => this.classes.add(name),
      remove: (name) => this.classes.delete(name),
      contains: (name) => this.classes.has(name),
    };
    this.isConnected = true;
    this.disabled = false;
    this.clickCount = 0;
    this.scrollIntoViewCount = 0;
    this.dispatchedEvents = [];
    this.options = [];
    this.selectedIndex = -1;
    this.value = '';
    if (parent) parent.children.push(this);
    if (onClick) this.__reactProps$test = { onClick };
  }

  getBoundingClientRect() {
    return this.rect;
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  contains(element) {
    for (let current = element; current; current = current.parentElement) {
      if (current === this) return true;
    }
    return false;
  }

  closest(selector) {
    if (selector === 'svg') return null;
    return null;
  }

  querySelectorAll() {
    return [];
  }

  focus() {
    this.documentObj.activeElement = this;
  }

  scrollIntoView() {
    this.scrollIntoViewCount += 1;
  }

  click() {
    this.clickCount += 1;
    this.__reactProps$test?.onClick?.();
  }

  dispatchEvent(event) {
    this.dispatchedEvents.push(event.type);
    return true;
  }
}

function createRect(left, top, width, height) {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

async function createController() {
  const documentObj = {
    activeElement: null,
    elements: [],
    getElementById: () => null,
    createElement: () => ({ id: '', textContent: '' }),
    querySelectorAll() {
      return this.elements;
    },
  };
  documentObj.head = { appendChild() {} };
  documentObj.documentElement = new FakeElement(documentObj, {
    tagName: 'HTML',
    rect: createRect(0, 0, 1000, 600),
  });
  documentObj.body = new FakeElement(documentObj, {
    tagName: 'BODY',
    rect: createRect(0, 0, 1000, 600),
  });
  documentObj.elementFromPoint = (x, y) => {
    const matches = documentObj.elements.filter((element) => {
      const rect = element.getBoundingClientRect();
      return element.isConnected
        && x >= rect.left && x <= rect.right
        && y >= rect.top && y <= rect.bottom;
    });
    return matches.sort((left, right) => {
      const depth = (element) => {
        let value = 0;
        for (let current = element.parentElement; current; current = current.parentElement) value += 1;
        return value;
      };
      return depth(right) - depth(left);
    })[0] || documentObj.body;
  };

  const windowObj = {
    innerWidth: 1000,
    innerHeight: 600,
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
    requestAnimationFrame: (callback) => callback(),
    setInterval: () => 1,
    clearInterval() {},
    setTimeout: (callback) => callback(),
    clearTimeout() {},
    scrollBy() {},
  };
  const context = {
    window: windowObj,
    document: documentObj,
    MutationObserver: class { observe() {} },
    Event,
    Number,
    Object,
    Array,
    Boolean,
    String,
    Math,
  };
  const source = await readFile(
    new URL('../android/src/main/res/raw/tv_remote_navigation.js', import.meta.url),
    'utf8',
  );
  vm.runInNewContext(source, context);
  return { controller: windowObj.__rugareTvRemote, documentObj };
}

test('TV web shell crosses card columns and discovers React menu controls', async () => {
  const { controller, documentObj } = await createController();
  const activated = [];
  const leftCard = new FakeElement(documentObj, {
    rect: createRect(100, 100, 220, 180),
    text: 'News 24',
    onClick: () => activated.push('left'),
  });
  const leftFavorite = new FakeElement(documentObj, {
    rect: createRect(270, 220, 32, 32),
    text: 'Favorite',
    parent: leftCard,
    onClick: () => activated.push('favorite'),
  });
  const rightCard = new FakeElement(documentObj, {
    rect: createRect(500, 100, 220, 180),
    text: 'ZBC TV',
    onClick: () => activated.push('right'),
  });
  const menuItem = new FakeElement(documentObj, {
    rect: createRect(520, 360, 160, 48),
    text: 'Live TV menu item',
    onClick: () => activated.push('menu'),
  });
  documentObj.elements = [leftCard, leftFavorite, rightCard, menuItem];

  controller.move('down');
  assert.equal(leftCard.classes.has('rugare-tv-remote-focus'), true);

  controller.move('right');
  assert.equal(rightCard.classes.has('rugare-tv-remote-focus'), true);
  assert.equal(leftFavorite.classes.has('rugare-tv-remote-focus'), false);

  controller.move('down');
  assert.equal(menuItem.classes.has('rugare-tv-remote-focus'), true);
  controller.activate();
  assert.deepEqual(activated, ['menu']);
});

test('TV web shell restores focus after a React card is redrawn', async () => {
  const { controller, documentObj } = await createController();
  const original = new FakeElement(documentObj, {
    rect: createRect(100, 100, 220, 180),
    text: 'ZBC TV',
    onClick() {},
  });
  documentObj.elements = [original];
  controller.move('down');

  original.isConnected = false;
  const replacement = new FakeElement(documentObj, {
    rect: createRect(500, 100, 220, 180),
    text: 'ZBC TV',
    onClick() {},
  });
  documentObj.elements = [replacement];
  controller.refresh();

  assert.equal(replacement.classes.has('rugare-tv-remote-focus'), true);
});

test('TV web shell adjusts a video quality select with the D-pad', async () => {
  const { controller, documentObj } = await createController();
  const qualitySelect = new FakeElement(documentObj, {
    tagName: 'SELECT',
    rect: createRect(600, 300, 220, 48),
    text: 'Video Quality',
  });
  qualitySelect.options = [
    { value: 'auto', disabled: false },
    { value: '720p', disabled: false },
    { value: '480p', disabled: false },
  ];
  qualitySelect.selectedIndex = 0;
  qualitySelect.value = 'auto';
  documentObj.elements = [qualitySelect];

  controller.move('down');
  controller.activate();
  assert.equal(qualitySelect.classes.has('rugare-tv-select-adjusting'), true);

  controller.move('down');
  assert.equal(qualitySelect.selectedIndex, 1);
  assert.equal(qualitySelect.value, '720p');
  assert.deepEqual(qualitySelect.dispatchedEvents, ['input', 'change']);

  controller.move('right');
  assert.equal(qualitySelect.value, '480p');
  controller.activate();
  assert.equal(qualitySelect.classes.has('rugare-tv-select-adjusting'), false);
});

test('TV web shell automatically unmutes Sporty media', async () => {
  const { controller, documentObj } = await createController();
  const video = new FakeElement(documentObj, {
    tagName: 'VIDEO',
    rect: createRect(0, 0, 1280, 720),
  });
  video.defaultMuted = true;
  video.muted = true;
  video.volume = 0;
  video.paused = true;
  video.play = () => {
    video.paused = false;
    return Promise.resolve();
  };
  video.pause = () => {
    video.paused = true;
  };
  documentObj.elements = [video];

  controller.configure({ sporty: true, unmute: true });

  assert.equal(video.defaultMuted, false);
  assert.equal(video.muted, false);
  assert.equal(video.volume, 1);
});

test('Sporty mode starts player-first and jumps directly to live cards', async () => {
  const { controller, documentObj } = await createController();
  const video = new FakeElement(documentObj, {
    tagName: 'VIDEO',
    rect: createRect(0, 20, 1000, 300),
    text: 'SportyTV player',
  });
  video.paused = false;
  video.play = () => Promise.resolve();
  video.pause = () => {};
  const dateStrip = new FakeElement(documentObj, {
    tagName: 'BUTTON',
    rect: createRect(80, 340, 200, 48),
    text: 'Today 10 Aug',
  });
  const replayCard = new FakeElement(documentObj, {
    tagName: 'BUTTON',
    rect: createRect(80, 390, 360, 120),
    text: '12:00Replay Earlier game Genres: Football Start: 2026-08-10 12:00 | Duration: 120 Mins',
  });
  const firstGame = new FakeElement(documentObj, {
    tagName: 'BUTTON',
    rect: createRect(80, 520, 360, 120),
    text: '14:00LiveFirst live game Genres: Football Start: 2026-08-10 14:00 | Duration: 120 Mins',
  });
  const secondGame = new FakeElement(documentObj, {
    tagName: 'BUTTON',
    rect: createRect(80, 660, 360, 150),
    text: '18:00LiveSecond concurrent live game Genres: Football Start: 2026-08-10 18:00 | Duration: 120 Mins',
  });
  const newsTab = new FakeElement(documentObj, {
    tagName: 'BUTTON',
    rect: createRect(80, 900, 200, 48),
    text: 'News',
  });
  documentObj.elements = [video, dateStrip, replayCard, firstGame, secondGame, newsTab];

  controller.configure({ sporty: true, unmute: true });
  assert.equal(documentObj.documentElement.classes.has('rugare-sporty-full'), true);
  assert.equal(video.playsInline, false);

  controller.move('down');
  assert.equal(firstGame.classes.has('rugare-tv-remote-focus'), true);
  assert.equal(dateStrip.classes.has('rugare-tv-remote-focus'), false);
  assert.equal(replayCard.classes.has('rugare-tv-remote-focus'), false);
  assert.equal(documentObj.documentElement.classes.has('rugare-sporty-full'), false);
  assert.equal(video.paused, false);

  controller.move('down');
  assert.equal(secondGame.classes.has('rugare-tv-remote-focus'), true);
  assert.equal(secondGame.scrollIntoViewCount > 0, true);

  controller.move('down');
  assert.equal(secondGame.classes.has('rugare-tv-remote-focus'), true);
  assert.equal(newsTab.classes.has('rugare-tv-remote-focus'), false);

  controller.move('up');
  assert.equal(firstGame.classes.has('rugare-tv-remote-focus'), true);
  controller.move('up');
  assert.equal(documentObj.documentElement.classes.has('rugare-sporty-full'), true);
  assert.equal(video.paused, false);
});

test('Android fullscreen browser unmutes Sporty and forwards remote keys', async () => {
  const source = await readFile(
    new URL(
      '../android/src/main/java/com/mangezi/ftaiptv/InAppBrowserActivity.java',
      import.meta.url,
    ),
    'utf8',
  );
  const mainActivitySource = await readFile(
    new URL(
      '../android/src/main/java/com/mangezi/ftaiptv/MainActivity.java',
      import.meta.url,
    ),
    'utf8',
  );

  assert.match(source, /fullscreenPlayback \|\| isZbcUrl\(view\.getUrl\(\)\)/);
  assert.match(source, /customView != null && customView\.dispatchKeyEvent\(event\)/);
  assert.match(source, /view\.requestFocus\(\)/);
  assert.match(
    mainActivitySource,
    /isTelevisionDevice && isSportyPlayback\(packageName, fallbackUrl\)/,
  );
  assert.match(
    mainActivitySource,
    /openOfficialFallback\(fallbackUrl, true\)/,
  );
  assert.doesNotMatch(mainActivitySource, /sporty\.com\/football\/matches\/all/);
});
