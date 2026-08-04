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

  focus() {
    this.documentObj.activeElement = this;
  }

  scrollIntoView() {}

  click() {
    this.clickCount += 1;
    this.__reactProps$test?.onClick?.();
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
  documentObj.documentElement.classList = { add() {}, remove() {} };
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
