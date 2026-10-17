import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuality, selectQualityLevel } from '../src/quality.js';
import { getPlaybackSources } from '../src/catalog.js';

test('quality selections handle unsorted renditions, low-only feeds and automatic reset', () => {
  const levels = [{ height: 1080, bitrate: 4000000 }, { height: 360 }, { height: 720 }, { height: 480 }];
  assert.equal(selectQualityLevel(levels, 'high'), 0);
  assert.equal(selectQualityLevel(levels, '720p'), 2);
  assert.equal(selectQualityLevel(levels, 'data-saver'), 3);
  assert.equal(selectQualityLevel([{ height: 360 }], '1080p'), 0);
  assert.equal(selectQualityLevel([{ height: 1080 }], '720p'), 0);
  assert.equal(selectQualityLevel(levels, 'auto'), -1);
  assert.equal(normalizeQuality('obsolete'), 'auto');
  assert.equal(normalizeQuality('1080p'), '1080p');
});

test('global quality orders alternate feeds with working lower-quality fallbacks', () => {
  const channel = { variants: [{ url: 'sd', height: 360 }, { url: 'uhd', height: 2160 }, { url: 'hd', height: 720 }, { url: 'unknown', height: 0 }] };
  assert.deepEqual(getPlaybackSources(channel, 'high'), ['uhd', 'hd', 'sd', 'unknown']);
  assert.deepEqual(getPlaybackSources(channel, '720p'), ['hd', 'sd', 'unknown', 'uhd']);
  assert.deepEqual(getPlaybackSources(channel, 'auto'), ['sd', 'uhd', 'hd', 'unknown']);
});
