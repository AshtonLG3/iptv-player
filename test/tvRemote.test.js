import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectTelevision,
  getGlobalTvRemoteAction,
  getTvNavigationKey,
  getToggledTvPanel,
  getTvHorizontalPanelAction,
  getWrappedFocusIndex,
  shouldActivateTelevisionFromRemote,
} from '../src/tvRemote.js';

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
  assert.equal(getTvHorizontalPanelAction('channels', 'left'), 'channels');
  assert.equal(getTvHorizontalPanelAction('channels', 'right'), 'none');
  assert.equal(getTvHorizontalPanelAction('none', 'right'), 'settings');
  assert.equal(getTvHorizontalPanelAction('settings', 'right'), 'settings');
  assert.equal(getTvHorizontalPanelAction('settings', 'left'), 'none');
});

test('getWrappedFocusIndex wraps remote focus through a list', () => {
  assert.equal(getWrappedFocusIndex(3, -1, 1), 0);
  assert.equal(getWrappedFocusIndex(3, 2, 1), 0);
  assert.equal(getWrappedFocusIndex(3, 0, -1), 2);
});

test('getToggledTvPanel closes a panel when its remote key is pressed again', () => {
  assert.equal(getToggledTvPanel('none', 'channels'), 'channels');
  assert.equal(getToggledTvPanel('channels', 'channels'), 'none');
  assert.equal(getToggledTvPanel('settings', 'settings'), 'none');
  assert.equal(getToggledTvPanel('channels', 'settings'), 'settings');
});
