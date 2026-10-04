import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer } from '../src/player.js';

test('Android delegates sources, title and quality without starting browser playback', async () => {
  const calls = [];
  let pauses = 0;
  let resumes = 0;
  const video = createFakeVideo();
  const player = createPlayer(video, {
    HlsCtor: FakeHls,
    androidBridge: { playChannel: (...args) => calls.push(args), pauseChannel: () => pauses++, resumeChannel: () => resumes++ },
  });
  player.play(['http://example.com/live.m3u8', 'https://example.com/backup.m3u8'],
    { title: 'Pluto TV', quality: 'data-saver' });
  assert.deepEqual(JSON.parse(calls[0][0]), ['http://example.com/live.m3u8', 'https://example.com/backup.m3u8']);
  assert.deepEqual(calls[0].slice(1, 3), ['Pluto TV', 'data-saver']);
  assert.equal(video.playCalls, 0);
  player.suspend();
  assert.equal(pauses, 1);
  assert.equal(calls.length, 1);
  await player.resume();
  assert.equal(calls.length, 1);
  assert.equal(resumes, 1);
  player.destroy();
});

test('inline native playback state drives controls and ignores events from an earlier channel', () => {
  const events = new EventTarget();
  const video = createFakeVideo();
  const rendered = [];
  video.dispatchEvent = event => rendered.push(event.type);
  let lastRequest;
  let stops = 0;
  let error;
  const player = createPlayer(video, { nativeEvents: events, androidBridge: {
    playChannel: (...args) => { lastRequest = args[3]; },
    stopChannel: () => stops++, pauseChannel() {},
  } });
  player.onError(value => { error = value; });
  player.play('https://example.com/first.m3u8');
  const firstRequest = lastRequest;
  const emit = detail => events.dispatchEvent(Object.assign(new Event('rugare-native-playback'), { detail }));
  emit({ session: firstRequest, ready: true, playing: true });
  assert.equal(player.isPlaying(), true);
  assert.ok(rendered.includes('playing'));
  player.pause();
  emit({ session: firstRequest, ready: true, playing: false });
  assert.equal(player.isPlaying(), false);
  assert.ok(rendered.includes('pause'));
  player.play('https://example.com/second.m3u8');
  assert.equal(stops, 1);
  emit({ session: firstRequest, ready: true, playing: true, error: 'stale error' });
  assert.equal(player.isPlaying(), false);
  assert.equal(error, undefined);
  emit({ session: lastRequest, error: 'ERROR_CODE_IO_NETWORK_CONNECTION_FAILED' });
  assert.match(error.message, /NETWORK/);
  player.destroy();
});

test('on-demand playback can use the original browser player and stop native channel playback', () => {
  const calls = [];
  const video = createFakeVideo({ canPlayHls: true });
  const player = createPlayer(video, { androidBridge: { playChannel: () => calls.push('play'), stopChannel: () => calls.push('stop') } });
  player.play('https://example.com/live.m3u8');
  player.play('https://example.com/movie.mp4', { nativePlayback: false });
  assert.deepEqual(calls, ['play', 'stop']);
  assert.equal(video.src, 'https://example.com/movie.mp4');
  assert.equal(video.playCalls, 1);
  player.destroy();
});

test('Android bridge failures report the error without launching browser requests', () => {
  const video = createFakeVideo();
  const player = createPlayer(video, { androidBridge: { playChannel: () => { throw new Error('Launch failed'); } } });
  let error;
  player.onError(value => { error = value; });
  player.play('https://example.com/live.m3u8');
  assert.equal(error.message, 'Launch failed');
  assert.equal(video.playCalls, 0);
  player.destroy();
});

class FakeHls {
  static supported = true;
  static Events = { ERROR: 'error', MANIFEST_PARSED: 'manifest_parsed' };
  static ErrorTypes = { NETWORK_ERROR: 'networkError', MEDIA_ERROR: 'mediaError' };
  static instances = [];

  static isSupported() {
    return FakeHls.supported;
  }

  constructor(config) {
    this.config = config;
    this.handlers = {};
    this.loadSourceCalls = [];
    this.attachMediaCalls = [];
    this.destroyed = false;
    this.startLoadCalls = [];
    this.stopLoadCalls = 0;
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

  startLoad(position) {
    this.startLoadCalls.push(position);
  }

  stopLoad() {
    this.stopLoadCalls += 1;
  }

  trigger(event, data) {
    this.handlers[event]?.(null, data);
  }
}

test('data saver uses adaptive HLS and caps available renditions at 480p', () => {
  FakeHls.supported = true;
  FakeHls.instances = [];
  const video = createFakeVideo({ canPlayHls: true });
  const player = createPlayer(video, { HlsCtor: FakeHls });
  player.play('https://example.com/master.m3u8', { quality: 'data-saver' });
  const hls = FakeHls.instances[0];
  hls.levels = [{ height: 360 }, { height: 480 }, { height: 720 }, { height: 1080 }];
  hls.trigger('manifest_parsed');
  assert.equal(hls.autoLevelCapping, 1);
  assert.equal(hls.config.startLevel, -1);
  player.destroy();
});

test('autoplay rejection preserves the stream and does not cycle through backups', async () => {
  FakeHls.supported = true;
  FakeHls.instances = [];
  const video = createFakeVideo({ canPlayHls: true });
  video.play = () => Promise.reject(Object.assign(new Error('Gesture required'), { name: 'NotAllowedError' }));
  const player = createPlayer(video, { HlsCtor: FakeHls });
  let error;
  player.onError((value) => { error = value; });
  player.play(['https://example.com/first.m3u8', 'https://example.com/backup.m3u8']);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(error.name, 'NotAllowedError');
  assert.equal(video.src, 'https://example.com/first.m3u8');
  assert.equal(FakeHls.instances.length, 0);
  player.destroy();
});

function createFakeVideo({ canPlayHls = false, playResolves = true } = {}) {
  const errorListeners = [];
  const playingListeners = [];
  return {
    src: '',
    muted: false,
    volume: 1,
    paused: false,
    pauseCalls: 0,
    playCalls: 0,
    removeAttribute() {},
    canPlayType: (type) => (canPlayHls && type === 'application/vnd.apple.mpegurl' ? 'maybe' : ''),
    play() {
      this.paused = false;
      this.playCalls += 1;
      return playResolves ? Promise.resolve() : Promise.reject(new Error('play failed'));
    },
    pause() {
      this.paused = true;
      this.pauseCalls += 1;
    },
    addEventListener(event, cb) {
      if (event === 'error') errorListeners.push(cb);
      if (event === 'playing') playingListeners.push(cb);
    },
    removeEventListener(event, cb) {
      const listeners = event === 'error' ? errorListeners : playingListeners;
      const index = listeners.indexOf(cb);
      if (index !== -1) listeners.splice(index, 1);
    },
    triggerError() {
      errorListeners.slice().forEach((cb) => cb());
    },
    triggerPlaying() { playingListeners.slice().forEach((cb) => cb()); },
  };
}

function fakeTimers() {
  const pending = new Map();
  let index = 0;
  return {
    set: (cb) => { pending.set(++index, cb); return index; },
    clear: (id) => pending.delete(id),
    fire: () => { const cb = pending.values().next().value; assert.ok(cb); cb(); },
    count: () => pending.size,
  };
}
test('silent native startup falls back to HLS, then to the backup, then reports failure', () => {
  FakeHls.supported = true;
  FakeHls.instances = [];
  const timers = fakeTimers();
  const player = createPlayer(createFakeVideo({ canPlayHls: true }), { HlsCtor: FakeHls, timers });
  let error;
  player.onError((e) => { error = e; });
  player.play(['https://example.com/primary.m3u8', 'https://example.com/backup.m3u8']);
  timers.fire();
  assert.equal(FakeHls.instances[0].loadSourceCalls[0], 'https://example.com/primary.m3u8');
  timers.fire(); // Next source starts natively.
  timers.fire(); // Its native attempt falls back to HLS.
  assert.equal(FakeHls.instances[1].loadSourceCalls[0], 'https://example.com/backup.m3u8');
  timers.fire();
  assert.match(error.message, /did not start/);
  assert.equal(timers.count(), 0);
});
test('startup timeout is cleared when playing, suspending, switching or destroying', () => {
  FakeHls.supported = false;
  const video = createFakeVideo({ canPlayHls: true });
  const timers = fakeTimers();
  const player = createPlayer(video, { HlsCtor: FakeHls, timers });
  player.play('https://example.com/one.m3u8');
  video.triggerPlaying();
  assert.equal(timers.count(), 0);
  player.play('https://example.com/two.m3u8');
  player.play('https://example.com/three.m3u8');
  assert.equal(timers.count(), 1);
  player.suspend();
  assert.equal(timers.count(), 0);
  player.play('https://example.com/four.m3u8');
  player.destroy();
  assert.equal(timers.count(), 0);
});

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

test('play() prefers native HLS when browser support is available', () => {
  FakeHls.supported = true;
  FakeHls.instances = [];
  const video = createFakeVideo({ canPlayHls: true });
  const player = createPlayer(video, { HlsCtor: FakeHls });

  player.play('https://example.com/stream.m3u8');

  assert.equal(video.src, 'https://example.com/stream.m3u8');
  assert.equal(FakeHls.instances.length, 0);
});

test('play() retries with Hls.js when native HLS fails', () => {
  FakeHls.supported = true;
  FakeHls.instances = [];
  const video = createFakeVideo({ canPlayHls: true });
  const player = createPlayer(video, { HlsCtor: FakeHls });

  let receivedError = null;
  player.onError((err) => { receivedError = err; });
  player.play('https://example.com/stream.m3u8');

  video.triggerError();

  assert.equal(receivedError, null);
  assert.equal(FakeHls.instances.length, 1);
  assert.equal(FakeHls.instances[0].loadSourceCalls[0], 'https://example.com/stream.m3u8');
});

test('play() tries the next source after a fatal Hls.js failure', () => {
  FakeHls.supported = true;
  FakeHls.instances = [];
  const video = createFakeVideo();
  const player = createPlayer(video, { HlsCtor: FakeHls });

  let receivedError = null;
  player.onError((err) => { receivedError = err; });
  player.play(['https://example.com/bad.m3u8', 'https://example.com/good.m3u8']);

  FakeHls.instances[0].trigger('error', { fatal: true, details: 'manifestLoadError' });

  assert.equal(receivedError, null);
  assert.equal(FakeHls.instances.length, 2);
  assert.equal(FakeHls.instances[1].loadSourceCalls[0], 'https://example.com/good.m3u8');
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

test('play() replaces the native error listener on a channel switch, avoiding stale double-fires', () => {
  FakeHls.supported = false;
  const video = createFakeVideo({ canPlayHls: true });
  const player = createPlayer(video, { HlsCtor: FakeHls });

  const receivedErrors = [];
  player.onError((err) => { receivedErrors.push(err); });

  player.play('https://example.com/stream-a.m3u8');
  player.play('https://example.com/stream-b.m3u8');

  video.triggerError();

  assert.equal(receivedErrors.length, 1);
});

test('destroy() removes a registered native error listener', () => {
  FakeHls.supported = false;
  const video = createFakeVideo({ canPlayHls: true });
  const player = createPlayer(video, { HlsCtor: FakeHls });

  let receivedError = null;
  player.onError((err) => { receivedError = err; });
  player.play('https://example.com/stream.m3u8');
  player.destroy();

  video.triggerError();

  assert.equal(receivedError, null);
});

test('suspend() prevents delayed HLS autoplay and resume() restores playback explicitly', () => {
  FakeHls.supported = true;
  FakeHls.instances = [];
  const video = createFakeVideo();
  const player = createPlayer(video, { HlsCtor: FakeHls });

  player.play('https://example.com/stream.m3u8');
  const instance = FakeHls.instances[0];
  player.suspend();
  instance.trigger('manifest_parsed');

  assert.equal(video.pauseCalls, 1);
  assert.equal(video.playCalls, 0);
  assert.equal(video.muted, true);
  assert.equal(video.volume, 0);
  assert.equal(instance.stopLoadCalls, 1);

  player.resume();

  assert.equal(video.playCalls, 1);
  assert.equal(video.muted, false);
  assert.equal(video.volume, 1);
  assert.deepEqual(instance.startLoadCalls, [-1]);
});
