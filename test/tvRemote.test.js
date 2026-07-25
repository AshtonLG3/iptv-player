import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectTelevision,
  getGlobalTvRemoteAction,
  getWrappedFocusIndex,
} from '../src/tvRemote.js';

test('detectTelevision prefers the native Android TV bridge', () => {
  assert.equal(detectTelevision({ bridge: { isTelevision: () => true } }), true);
});

test('detectTelevision falls back to common television user agents', () => {
  assert.equal(detectTelevision({ userAgent: 'Mozilla/5.0 (Linux; Android 11; Android TV)' }), true);
  assert.equal(detectTelevision({ userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A165F)' }), false);
});

test('getGlobalTvRemoteAction keeps channels and settings on separate keys', () => {
  assert.equal(getGlobalTvRemoteAction({ key: 'ArrowLeft' }), 'channels');
  assert.equal(getGlobalTvRemoteAction({ key: 'ArrowRight' }), 'settings');
  assert.equal(getGlobalTvRemoteAction({ key: 'ChannelUp' }), 'channel-next');
  assert.equal(getGlobalTvRemoteAction({ key: 'ChannelDown' }), 'channel-previous');
});

test('getWrappedFocusIndex wraps remote focus through a list', () => {
  assert.equal(getWrappedFocusIndex(3, -1, 1), 0);
  assert.equal(getWrappedFocusIndex(3, 2, 1), 0);
  assert.equal(getWrappedFocusIndex(3, 0, -1), 2);
});
