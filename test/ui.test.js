import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterChannelsForUi,
  getCategoryNames,
  getChannelInitials,
  resolveChannelLogoUrl,
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

test('resolveChannelLogoUrl uses bundled artwork inside the Android app', () => {
  const publicUrl = 'https://mangezi.xyz/tv/assets/channels/neotv/cricket-gold.jpg';

  assert.equal(
    resolveChannelLogoUrl(publicUrl, { hostname: 'appassets.androidplatform.net' }),
    'https://appassets.androidplatform.net/assets/assets/channels/neotv/cricket-gold.jpg',
  );
  assert.equal(resolveChannelLogoUrl(publicUrl, { hostname: 'mangezi.xyz' }), publicUrl);
});

test('filterChannelsForUi matches a selected folder by category token', () => {
  const filtered = filterChannelsForUi(CHANNELS, { category: 'Cue Sports' });

  assert.deepEqual(
    filtered.map((channel) => channel.name),
    ['Pluto TV Snooker 900', 'World Billiards TV'],
  );
});

test('filterChannelsForUi still narrows folders by country when both filters match', () => {
  const filtered = filterChannelsForUi(CHANNELS, { category: 'Cue Sports', country: 'us' });

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
