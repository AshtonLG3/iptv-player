import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { parseXmltvTime, matchGuideChannel, getGuideSchedule, decodeGuideBytes, EPG_MAX_BYTES } from '../src/epg.js';

test('XMLTV offsets and UTC cross dates correctly; invalid times are rejected', () => {
  assert.equal(parseXmltvTime('20261004010000 +0200'), Date.parse('2026-10-03T23:00:00Z'));
  assert.equal(parseXmltvTime('20261004123000 -0530'), Date.parse('2026-10-04T18:00:00Z'));
  assert.equal(parseXmltvTime('202610041230'), Date.parse('2026-10-04T12:30:00Z'));
  for (const bad of ['20260231000000 +0000', '20261004240000', '20261004123000 +0060', 'not a date'])
    assert.ok(Number.isNaN(parseXmltvTime(bad)));
});

const guide = { channels: [{ id: 'NollyAfrica.uk', names: ['Nolly Africa HD'] },
  { id: 'duplicate1', names: ['News'] }, { id: 'duplicate2', names: ['News'] }],
programmes: { 'NollyAfrica.uk': [{ start: 10, stop: 20, title: 'First' }, { start: 20, stop: 30, title: 'Second' }],
  duplicate1: [], duplicate2: [] } };

test('guide matching uses tvg-id and feed variants before unique normalized names', () => {
  assert.equal(matchGuideChannel(guide, { tvgId: 'NollyAfrica.uk@SD', name: 'Wrong' }), 'NollyAfrica.uk');
  assert.equal(matchGuideChannel(guide, { name: 'Nolly Africa (1080p)' }), 'NollyAfrica.uk');
  assert.equal(matchGuideChannel(guide, { name: 'News' }), '');
  assert.equal(matchGuideChannel(guide, { name: 'News' }, 'duplicate2'), 'duplicate2');
  assert.equal(matchGuideChannel(guide, { name: 'Unknown' }, 'nonexistent'), '');
  assert.equal(matchGuideChannel(guide, { name: 'Anything', variants: [{ tvgId: 'NollyAfrica.uk' }] }), 'NollyAfrica.uk');
});

test('now/next respects programme end boundaries and guide gaps', () => {
  assert.equal(getGuideSchedule(guide, 'NollyAfrica.uk', 19).current.title, 'First');
  assert.equal(getGuideSchedule(guide, 'NollyAfrica.uk', 20).current.title, 'Second');
  assert.equal(getGuideSchedule(guide, 'NollyAfrica.uk', 30).current, null);
  assert.equal(getGuideSchedule(guide, 'NollyAfrica.uk', 1).upcoming[0].title, 'First');
  assert.deepEqual(getGuideSchedule(guide, 'Missing'), { current: null, upcoming: [] });
});

test('guide decoder accepts plain XML and gzip, limiting expanded size', async () => {
  const xml = '<tv><channel id="a"><display-name>News &amp; Talk</display-name></channel></tv>';
  assert.equal(await decodeGuideBytes(new TextEncoder().encode(xml)), xml);
  assert.equal(await decodeGuideBytes(gzipSync(xml)), xml);
  await assert.rejects(decodeGuideBytes(gzipSync('a'.repeat(EPG_MAX_BYTES + 1))), /exceeds 20 MB/);
});
