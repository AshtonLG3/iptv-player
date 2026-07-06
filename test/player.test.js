import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer } from '../src/player.js';

class FakeHls {
  static supported = true;
  static Events = { ERROR: 'error', MANIFEST_PARSED: 'manifest_parsed' };
  static instances = [];

  static isSupported() {
    return FakeHls.supported;
  }

  constructor() {
    this.handlers = {};
    this.loadSourceCalls = [];
    this.attachMediaCalls = [];
    this.destroyed = false;
    FakeHls.instances.push(this);
  }

  on(event, cb) {
    this.handlers[event] = cb;
  }

  loadSource(url) {
    this.loadSourceCalls.push(url);
  }

  attachMedia(el) {
    this.attachMediaCalls.push(el);
  }

  destroy() {
    this.destroyed = true;
  }

  trigger(event, data) {
    this.handlers[event]?.(null, data);
  }
}

function createFakeVideo({ canPlayHls = false, playResolves = true } = {}) {
  return {
    src: '',
    removeAttribute() {},
    canPlayType: (type) => (canPlayHls && type === 'application/vnd.apple.mpegurl' ? 'maybe' : ''),
    play() {
      return playResolves ? Promise.resolve() : Promise.reject(new Error('play failed'));
    },
    addEventListener() {},
  };
}

test('play() loads the source into Hls.js and attaches it to the video element', () => {
  FakeHls.supported = true;
  FakeHls.instances = [];
  const video = createFakeVideo();
  const player = createPlayer(video, { HlsCtor: FakeHls });

  player.play('https://example.com/stream.m3u8');

  const instance = FakeHls.instances[0];
  assert.equal(instance.loadSourceCalls[0], 'https://example.com/stream.m3u8');
  assert.equal(instance.attachMediaCalls[0], video);
});

test('play() reports fatal Hls.js errors via onError', () => {
  FakeHls.supported = true;
  FakeHls.instances = [];
  const video = createFakeVideo();
  const player = createPlayer(video, { HlsCtor: FakeHls });

  let receivedError = null;
  player.onError((err) => { receivedError = err; });
  player.play('https://example.com/stream.m3u8');

  FakeHls.instances[0].trigger('error', { fatal: true, details: 'networkError' });

  assert.ok(receivedError);
  assert.equal(receivedError.message, 'networkError');
});

test('play() ignores non-fatal Hls.js errors', () => {
  FakeHls.supported = true;
  FakeHls.instances = [];
  const video = createFakeVideo();
  const player = createPlayer(video, { HlsCtor: FakeHls });

  let receivedError = null;
  player.onError((err) => { receivedError = err; });
  player.play('https://example.com/stream.m3u8');

  FakeHls.instances[0].trigger('error', { fatal: false, details: 'bufferStall' });

  assert.equal(receivedError, null);
});

test('play() falls back to native playback when Hls.js is unsupported', () => {
  FakeHls.supported = false;
  const video = createFakeVideo({ canPlayHls: true });
  const player = createPlayer(video, { HlsCtor: FakeHls });

  player.play('https://example.com/stream.m3u8');

  assert.equal(video.src, 'https://example.com/stream.m3u8');
});

test('play() reports an error when neither Hls.js nor native HLS is available', () => {
  FakeHls.supported = false;
  const video = createFakeVideo({ canPlayHls: false });
  const player = createPlayer(video, { HlsCtor: FakeHls });

  let receivedError = null;
  player.onError((err) => { receivedError = err; });
  player.play('https://example.com/stream.m3u8');

  assert.ok(receivedError);
  assert.match(receivedError.message, /not supported/);
});
