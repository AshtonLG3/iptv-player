import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectTelevision,
  createBackExitPolicy,
  dispatchNativeTvKey,
  getBoundedFocusIndex,
  getGlobalTvRemoteAction,
  getTvNavigationKey,
  getTvBackPanel,
  getToggledTvPanel,
  getTvHorizontalPanelAction,
  getTvVerticalPanelAction,
  getWrappedFocusIndex,
  shouldActivateTelevisionFromRemote,
} from '../src/tvRemote.js';

test('four deliberate Back presses exit, rapid double Back exits, held Back and resets do not', () => {
  let time = 0;
  const policy = createBackExitPolicy({ now: () => time });
  for (let index = 0; index < 4; index += 1) {
    time += 2000;
    assert.equal(policy.press().exit, index === 3);
  }
  policy.reset();
  assert.equal(policy.press().exit, false);
  time += 150;
  assert.deepEqual(policy.press({ repeat: true }), { exit: false, ignored: true });
  assert.equal(policy.press().exit, true);
  policy.reset();
  assert.equal(policy.press().exit, false);
});

test('native Android D-pad reaches navigation and OK activates once without browser defaults', () => {
  const keys = [];
  let clicks = 0;
  const target = { tagName: 'BUTTON', click() { clicks += 1; } };
  const handlers = { activeElement: () => target, onKeydown(event) { keys.push(event.key); } };
  for (const code of [19, 20, 21, 22]) assert.equal(dispatchNativeTvKey(code, 0, handlers), true);
  assert.deepEqual(keys, ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  for (const code of [23, 66, 160]) {
    dispatchNativeTvKey(code, 0, handlers);
    dispatchNativeTvKey(code, 1, handlers);
  }
  assert.equal(clicks, 3);
  assert.equal(dispatchNativeTvKey(99, 0, handlers), false);
});

test('native OK honors handled actions and leaves select/text fields to the WebView', () => {
  let clicks = 0;
  const target = { tagName: 'BUTTON', click() { clicks += 1; } };
  assert.equal(dispatchNativeTvKey(23, 0, { activeElement: () => target,
    onKeydown(event) { event.preventDefault(); } }), true);
  assert.equal(clicks, 0);
  for (const field of [{ tagName: 'SELECT' }, { tagName: 'INPUT', type: 'text' }, { tagName: 'TEXTAREA' }]) {
    assert.equal(dispatchNativeTvKey(23, 0, { activeElement: () => field,
      onKeydown() { assert.fail('Native input should be preserved'); } }), false);
  }
});

test('detectTelevision prefers the native Android TV bridge', () => {
  assert.equal(detectTelevision({ bridge: { isTelevision: () => true } }), true);
});

test('detectTelevision falls back to common television user agents', () => {
  assert.equal(detectTelevision({ userAgent: 'Mozilla/5.0 (Linux; Android 11; Android TV)' }), true);
  assert.equal(detectTelevision({ userAgent: 'Mozilla/5.0 (Linux; Android 11; TCL 55P635)' }), true);
  assert.equal(detectTelevision({ userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A165F)' }), false);
});

test('getTvNavigationKey normalizes raw Android and smart-TV remote key codes', () => {
  assert.equal(getTvNavigationKey({ keyCode: 19 }), 'ArrowUp');
  assert.equal(getTvNavigationKey({ keyCode: 20 }), 'ArrowDown');
  assert.equal(getTvNavigationKey({ keyCode: 21 }), 'ArrowLeft');
  assert.equal(getTvNavigationKey({ keyCode: 22 }), 'ArrowRight');
  assert.equal(getTvNavigationKey({ keyCode: 23 }), 'Enter');
  assert.equal(getTvNavigationKey({ keyCode: 10009 }), 'BrowserBack');
});

test('remote input activates TV mode on large Android or keyboard-only displays', () => {
  assert.equal(shouldActivateTelevisionFromRemote({
    event: { keyCode: 20 },
    viewportWidth: 1920,
    userAgent: 'Mozilla/5.0 (Linux; Android 11; Generic TV Box)',
    maxTouchPoints: 0,
  }), true);
  assert.equal(shouldActivateTelevisionFromRemote({
    event: { key: 'ArrowDown' },
    viewportWidth: 390,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile)',
    maxTouchPoints: 5,
  }), false);
  assert.equal(shouldActivateTelevisionFromRemote({
    event: { key: 'a' },
    viewportWidth: 1920,
    userAgent: 'Mozilla/5.0 (Linux; Android 11)',
    maxTouchPoints: 0,
  }), false);
});

test('getGlobalTvRemoteAction keeps horizontal remote directions distinct', () => {
  assert.equal(getGlobalTvRemoteAction({ key: 'ArrowLeft' }), 'left');
  assert.equal(getGlobalTvRemoteAction({ key: 'ArrowRight' }), 'right');
  assert.equal(getGlobalTvRemoteAction({ key: 'ContextMenu' }), 'settings');
  assert.equal(getGlobalTvRemoteAction({ key: 'ChannelUp' }), 'channel-next');
  assert.equal(getGlobalTvRemoteAction({ key: 'ChannelDown' }), 'channel-previous');
});

test('getTvHorizontalPanelAction opens and exits side panels without looping', () => {
  assert.equal(getTvHorizontalPanelAction('none', 'left'), 'channels');
  assert.equal(getTvHorizontalPanelAction('channels', 'left'), 'categories');
  assert.equal(getTvHorizontalPanelAction('categories', 'left'), 'none');
  assert.equal(getTvHorizontalPanelAction('channels', 'right'), 'none');
  assert.equal(getTvHorizontalPanelAction('none', 'right'), 'channels');
  assert.equal(getTvHorizontalPanelAction('settings', 'right'), 'browse');
  assert.equal(getTvHorizontalPanelAction('settings', 'left'), 'browse');
});

test('Back opens categories and root, then returns to playback without exiting', () => {
  assert.equal(getTvBackPanel('none'), 'browse');
  assert.equal(getTvBackPanel('browse'), 'settings');
  assert.equal(getTvBackPanel('settings'), 'none');
  assert.equal(getTvBackPanel('countries'), 'settings');
  assert.equal(getTvBackPanel('favorite'), 'none');
  for (const child of ['categories', 'channels', 'apps', 'playback', 'services']) {
    assert.equal(getTvBackPanel(child), 'browse');
  }
  assert.equal(getTvBackPanel('preferences'), 'settings');
  assert.equal(getTvHorizontalPanelAction('settings', 'right'), 'browse');
  assert.equal(getTvHorizontalPanelAction('channels', 'right'), 'none');
});

test('Left reveals channels then categories; Right reverses the overlay layers', () => {
  assert.equal(getTvHorizontalPanelAction('none', 'left'), 'channels');
  assert.equal(getTvHorizontalPanelAction('channels', 'left'), 'categories');
  assert.equal(getTvHorizontalPanelAction('categories', 'left'), 'none');
  assert.equal(getTvHorizontalPanelAction('categories', 'right'), 'channels');
  assert.equal(getTvHorizontalPanelAction('channels', 'right'), 'none');
  assert.equal(getTvHorizontalPanelAction('apps', 'left'), 'browse');
});

test('getWrappedFocusIndex wraps remote focus through a list', () => {
  assert.equal(getWrappedFocusIndex(3, -1, 1), 0);
  assert.equal(getWrappedFocusIndex(3, 2, 1), 0);
  assert.equal(getWrappedFocusIndex(3, 0, -1), 2);
});

test('getBoundedFocusIndex keeps long TV lists at their real boundaries', () => {
  assert.equal(getBoundedFocusIndex(3, -1, 1), 0);
  assert.equal(getBoundedFocusIndex(3, 2, 1), 2);
  assert.equal(getBoundedFocusIndex(3, 0, -1), 0);
  assert.equal(getBoundedFocusIndex(3, 1, -1), 0);
});

test('vertical navigation exposes the standalone category panel from channels', () => {
  assert.equal(getTvVerticalPanelAction('channels', 'up'), 'browse');
  assert.equal(getTvVerticalPanelAction('channel-services', 'down'), 'browse');
});

test('getToggledTvPanel closes a panel when its remote key is pressed again', () => {
  assert.equal(getToggledTvPanel('none', 'channels'), 'channels');
  assert.equal(getToggledTvPanel('channels', 'channels'), 'none');
  assert.equal(getToggledTvPanel('settings', 'settings'), 'none');
  assert.equal(getToggledTvPanel('channels', 'settings'), 'settings');
});
