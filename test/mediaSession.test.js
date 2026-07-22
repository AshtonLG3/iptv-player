import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateMediaSession } from '../src/mediaSession.js';

class FakeMediaMetadata {
  constructor(data) {
    Object.assign(this, data);
  }
}

function createFakeMediaSession() {
  return {
    handlers: {},
    metadata: null,
    playbackState: 'none',
    setActionHandler(action, handler) {
      this.handlers[action] = handler;
    },
  };
}

test('updateMediaSession publishes channel metadata and track navigation handlers', () => {
  const mediaSession = createFakeMediaSession();
  let previousCalls = 0;
  let nextCalls = 0;

  const updated = updateMediaSession({
    mediaSession,
    MediaMetadataCtor: FakeMediaMetadata,
    channel: {
      name: 'AP TV',
      logo: 'https://example.com/logo.png',
    },
    canNavigate: true,
    onPrevious: () => { previousCalls += 1; },
    onNext: () => { nextCalls += 1; },
  });

  assert.equal(updated, true);
  assert.equal(mediaSession.metadata.title, 'AP TV');
  assert.equal(mediaSession.metadata.artist, 'FTA IPTV Player');
  assert.equal(mediaSession.metadata.artwork[0].src, 'https://example.com/logo.png');
  assert.equal(mediaSession.playbackState, 'playing');

  mediaSession.handlers.previoustrack();
  mediaSession.handlers.nexttrack();

  assert.equal(previousCalls, 1);
  assert.equal(nextCalls, 1);
});

test('updateMediaSession forwards metadata to the native Android bridge', () => {
  const calls = [];
  const nativeBridge = {
    update(...args) {
      calls.push(args);
    },
  };

  const updated = updateMediaSession({
    mediaSession: null,
    nativeBridge,
    channel: {
      name: 'Total Music Concerts',
      logo: 'https://example.com/music.png',
    },
    canNavigate: true,
    isPlaying: true,
  });

  assert.equal(updated, true);
  assert.deepEqual(calls, [[
    'Total Music Concerts',
    'FTA IPTV Player',
    'https://example.com/music.png',
    true,
    true,
  ]]);
});

test('updateMediaSession clears the native Android bridge without a channel', () => {
  let clearCalls = 0;
  const nativeBridge = {
    clear() {
      clearCalls += 1;
    },
  };

  const updated = updateMediaSession({
    mediaSession: null,
    nativeBridge,
    channel: null,
  });

  assert.equal(updated, true);
  assert.equal(clearCalls, 1);
});

test('updateMediaSession clears track handlers when there is one visible channel', () => {
  const mediaSession = createFakeMediaSession();

  updateMediaSession({
    mediaSession,
    MediaMetadataCtor: FakeMediaMetadata,
    channel: { name: 'Only Channel', logo: '' },
    canNavigate: false,
    onPrevious: () => {},
    onNext: () => {},
  });

  assert.equal(mediaSession.handlers.previoustrack, null);
  assert.equal(mediaSession.handlers.nexttrack, null);
});

test('updateMediaSession is a no-op when Media Session is unavailable', () => {
  assert.equal(updateMediaSession({ mediaSession: null }), false);
});
