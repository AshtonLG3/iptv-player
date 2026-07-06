import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseM3U, extractCountryCode, filterBySadc } from '../src/parser.js';

const SAMPLE = `#EXTM3U
#EXTINF:-1 tvg-id="NBC1.na@SD" tvg-logo="https://example.com/nbc.png" group-title="General",NBC1 (720p)
https://example.com/nbc1.m3u8
#EXTINF:-1 tvg-id="2MMonde.ma@SD" tvg-logo="https://example.com/2m.png" http-referrer="http://x" group-title="General",2M Monde (360p)
#EXTVLCOPT:http-referrer=http://x
https://example.com/2m.m3u8
#EXTINF:-1 tvg-id="" tvg-logo="" group-title="Movies",Unknown Channel
https://example.com/unknown.m3u8
#EXTINF:-1 tvg-id="CapeTownTV.za@SD" tvg-logo="" group-title="Entertainment;Family",Cape Town TV
https://example.com/capetown.m3u8
`;

test('extractCountryCode reads the country suffix from tvg-id', () => {
  assert.equal(extractCountryCode('NBC1.na@SD'), 'na');
  assert.equal(extractCountryCode('2MMonde.ma@SD'), 'ma');
  assert.equal(extractCountryCode('ch4teen.kw'), 'kw');
  assert.equal(extractCountryCode(''), null);
  assert.equal(extractCountryCode(undefined), null);
});

test('parseM3U extracts all channels, skipping #EXTVLCOPT lines', () => {
  const channels = parseM3U(SAMPLE);

  assert.equal(channels.length, 4);
  assert.deepEqual(channels[0], {
    name: 'NBC1 (720p)',
    tvgId: 'NBC1.na@SD',
    logo: 'https://example.com/nbc.png',
    category: 'General',
    country: 'na',
    url: 'https://example.com/nbc1.m3u8',
  });
  assert.equal(channels[1].url, 'https://example.com/2m.m3u8');
  assert.equal(channels[1].country, 'ma');
  assert.equal(channels[2].country, null);
  assert.equal(channels[3].category, 'Entertainment;Family');
});

test('filterBySadc keeps only SADC-country channels', () => {
  const channels = parseM3U(SAMPLE);
  const filtered = filterBySadc(channels);

  assert.equal(filtered.length, 2);
  assert.deepEqual(
    filtered.map((c) => c.name),
    ['NBC1 (720p)', 'Cape Town TV'],
  );
});
