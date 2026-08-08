import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTENT_CATEGORIES,
  MAX_RENDERED_CHANNELS,
  filterChannelsForUi,
  getCategoryNames,
  getChannelInitials,
  getContentCategory,
  limitChannelsForRendering,
  resolveChannelLogoUrl,
  sortChannelsAlphabetically,
  supportsNativeUpdates,
} from '../src/ui.js';

const CHANNELS = [
  {
    name: 'Pluto TV Snooker 900',
    category: 'Sports;Cue Sports',
    country: 'us',
    url: 'https://example.com/snooker.m3u8',
  },
  {
    name: 'World Billiards TV',
    category: 'Cue Sports',
    country: 'pl',
    url: 'https://example.com/billiards.m3u8',
  },
  {
    name: 'Cape Town TV',
    category: 'Africa',
    country: 'za',
    url: 'https://example.com/cape-town.m3u8',
  },
  {
    name: 'Regional Sports [Geo-blocked]',
    category: 'Sports',
    country: 'au',
    url: 'https://example.com/regional-sports.m3u8',
  },
  {
    name: 'Regional News [Geo-blocked]',
    category: 'International',
    country: 'au',
    url: 'https://example.com/regional-news.m3u8',
  },
];

test('supportsNativeUpdates only enables the control for the Android bridge', () => {
  assert.equal(supportsNativeUpdates({ checkForUpdate() {} }), true);
  assert.equal(supportsNativeUpdates({}), false);
  assert.equal(supportsNativeUpdates(null), false);
});

test('getCategoryNames splits multi-folder M3U group labels', () => {
  assert.deepEqual(getCategoryNames('Sports;Cue Sports|UK,International'), [
    'Sports',
    'Cue Sports',
    'UK',
    'International',
  ]);
});

test('getChannelInitials ignores quality labels and limits artwork fallback to two letters', () => {
  assert.equal(getChannelInitials('SABC News (1080p)'), 'SN');
  assert.equal(getChannelInitials('K24'), 'K');
  assert.equal(getChannelInitials(''), 'TV');
});

test('getContentCategory maps channels into conventional browsing categories', () => {
  assert.deepEqual(CONTENT_CATEGORIES.slice(0, 5), [
    'News',
    'Sports',
    'Movies',
    'Entertainment',
    'Wildlife',
  ]);
  assert.equal(getContentCategory({ name: 'SABC News', category: 'Africa' }), 'News');
  assert.equal(getContentCategory({ name: 'SABC Lehae', category: 'Africa' }), 'News');
  assert.equal(getContentCategory({ name: 'NBC 3 Las Vegas NV (KSNV)', category: 'USA' }), 'News');
  assert.equal(getContentCategory({ name: 'Cricket Gold', category: 'Sports' }), 'Sports');
  assert.equal(getContentCategory({ name: 'MyTime Movie Network', category: 'UK' }), 'Movies');
  assert.equal(getContentCategory({ name: 'BBC Earth', category: 'UK' }), 'Wildlife');
  assert.equal(getContentCategory({ name: 'Moonbug Kids', category: 'UK' }), 'Kids');
  assert.equal(getContentCategory({ name: 'NOW Rock', category: 'UK' }), 'Music');
  assert.equal(getContentCategory({ name: 'Autentic History', category: 'International' }), 'Documentary');
  assert.equal(getContentCategory({ name: 'Autentic Travel', category: 'UK' }), 'Lifestyle');
  assert.equal(getContentCategory({ name: 'Cape Town TV', category: 'Africa' }), 'General');
});

test('sortChannelsAlphabetically sorts case-insensitively and understands channel numbers', () => {
  const sorted = sortChannelsAlphabetically([
    { name: 'ZBC News' },
    { name: 'Channel 10 (1080p)' },
    { name: 'al Jazeera' },
    { name: 'Channel 2 [Geo-blocked]' },
  ]);

  assert.deepEqual(sorted.map((channel) => channel.name), [
    'al Jazeera',
    'Channel 2 [Geo-blocked]',
    'Channel 10 (1080p)',
    'ZBC News',
  ]);
});

test('limitChannelsForRendering keeps very large private playlists responsive', () => {
  const channels = Array.from(
    { length: MAX_RENDERED_CHANNELS + 25 },
    (_, index) => ({ name: `Channel ${index + 1}` }),
  );

  assert.equal(limitChannelsForRendering(channels).length, MAX_RENDERED_CHANNELS);
  assert.equal(limitChannelsForRendering(channels)[0].name, 'Channel 1');
});

test('resolveChannelLogoUrl uses bundled artwork inside the Android app', () => {
  const publicUrl = 'https://mangezi.xyz/tv/assets/channels/neotv/cricket-gold.jpg';

  assert.equal(
    resolveChannelLogoUrl(publicUrl, { hostname: 'appassets.androidplatform.net' }),
    'https://appassets.androidplatform.net/assets/assets/channels/neotv/cricket-gold.jpg',
  );
  assert.equal(resolveChannelLogoUrl(publicUrl, { hostname: 'mangezi.xyz' }), publicUrl);
});

test('filterChannelsForUi matches a conventional content category', () => {
  const filtered = filterChannelsForUi(CHANNELS, { category: 'Sports' });

  assert.deepEqual(
    filtered.map((channel) => channel.name),
    ['Pluto TV Snooker 900', 'World Billiards TV', 'Regional Sports [Geo-blocked]'],
  );
});

test('filterChannelsForUi still narrows folders by country when both filters match', () => {
  const filtered = filterChannelsForUi(CHANNELS, { category: 'Sports', country: 'us' });

  assert.deepEqual(
    filtered.map((channel) => channel.name),
    ['Pluto TV Snooker 900'],
  );
});

test('filterChannelsForUi keeps geo-restricted sports visible while hiding other blocked channels', () => {
  const filtered = filterChannelsForUi(CHANNELS, { hideGeoBlocked: true });

  assert.equal(filtered.some((channel) => channel.name === 'Regional Sports [Geo-blocked]'), true);
  assert.equal(filtered.some((channel) => channel.name === 'Regional News [Geo-blocked]'), false);
});
