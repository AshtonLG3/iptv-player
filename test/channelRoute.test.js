import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createChannelRouteIndex,
  getChannelPath,
  getPlayerBasePath,
  getRequestedChannelSlug,
  slugifyChannelName,
  supportsChannelRoutes,
} from '../src/channelRoute.js';

test('slugifyChannelName creates short readable channel slugs', () => {
  assert.equal(slugifyChannelName('Al Jazeera English'), 'al-jazeera');
  assert.equal(slugifyChannelName('SABC News (1080p)'), 'sabc-news');
  assert.equal(slugifyChannelName('Arts & Culture TV'), 'arts-and-culture-tv');
});

test('createChannelRouteIndex resolves slugs in both directions', () => {
  const channels = [
    { name: 'Al Jazeera English', tvgId: 'AlJazeera.qa@English', country: 'qa', url: 'https://one.test/live.m3u8' },
    { name: 'K24 (720p)', tvgId: 'K24.ke@HD', country: 'ke', url: 'https://two.test/live.m3u8' },
  ];
  const routes = createChannelRouteIndex(channels);

  assert.equal(routes.slugByUrl.get(channels[0].url), 'al-jazeera');
  assert.equal(routes.channelBySlug.get('al-jazeera'), channels[0]);
  assert.equal(routes.slugByUrl.get(channels[1].url), 'k24');
});

test('createChannelRouteIndex gives duplicate names deterministic unique slugs', () => {
  const channels = [
    { name: 'News HD', tvgId: 'News.zw', country: 'zw', url: 'https://z.test/live.m3u8' },
    { name: 'News HD', tvgId: 'News.za', country: 'za', url: 'https://a.test/live.m3u8' },
  ];
  const routes = createChannelRouteIndex(channels);

  assert.equal(routes.slugByUrl.get('https://a.test/live.m3u8'), 'news-hd');
  assert.equal(routes.slugByUrl.get('https://z.test/live.m3u8'), 'news-hd-zw');
});

test('channel route helpers support hosted, root, and Android paths', () => {
  assert.equal(getPlayerBasePath('/tv/al-jazeera/'), '/tv/');
  assert.equal(getPlayerBasePath('/al-jazeera/'), '/');
  assert.equal(getPlayerBasePath('/assets/index.html'), '/assets/');
  assert.equal(getRequestedChannelSlug('/tv/al-jazeera/', '/tv/'), 'al-jazeera');
  assert.equal(getRequestedChannelSlug('/tv/', '/tv/'), '');
  assert.equal(getChannelPath('/tv/', 'al-jazeera'), '/tv/al-jazeera/');
});

test('supportsChannelRoutes excludes the packaged Android player', () => {
  assert.equal(supportsChannelRoutes({
    locationObj: { protocol: 'https:', hostname: 'mangezi.xyz' },
  }), true);
  assert.equal(supportsChannelRoutes({
    locationObj: { protocol: 'https:', hostname: 'appassets.androidplatform.net' },
  }), false);
  assert.equal(supportsChannelRoutes({
    locationObj: { protocol: 'https:', hostname: 'mangezi.xyz' },
    hasAndroidBridge: true,
  }), false);
});
