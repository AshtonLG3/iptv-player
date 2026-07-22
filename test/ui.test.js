import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterChannelsForUi, getCategoryNames } from '../src/ui.js';

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
];

test('getCategoryNames splits multi-folder M3U group labels', () => {
  assert.deepEqual(getCategoryNames('Sports;Cue Sports|UK,International'), [
    'Sports',
    'Cue Sports',
    'UK',
    'International',
  ]);
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
