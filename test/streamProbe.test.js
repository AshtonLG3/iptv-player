import { test } from 'node:test';
import assert from 'node:assert/strict';
import { probeStream } from '../scripts/stream-probe.mjs';
import { formatM3U } from '../scripts/playlist-tools.mjs';
import { parseM3U } from '../src/parser.js';

const root = 'https://example.com/live/master.m3u8';
const mockFetch = (resources) => async (url) => {
  const item = resources[String(url)];
  const response = new Response(item?.body || 'Missing', { status: item?.status || (item ? 200 : 404) });
  Object.defineProperty(response, 'url', { value: String(url) });
  return response;
};
test('probe follows a relative rendition and verifies actual media bytes', async () => {
  const result = await probeStream(root, 1000, mockFetch({
    [root]: { body: '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\nlow/index.m3u8' },
    'https://example.com/live/low/index.m3u8': { body: '#EXTM3U\n#EXTINF:4,\nseg.ts' },
    'https://example.com/live/low/seg.ts': { body: new Uint8Array([0x47, 1, 2, 3]) },
  }));
  assert.equal(result.ok, true);
  assert.equal(result.segmentUrl, 'https://example.com/live/low/seg.ts');
});
test('a valid manifest with a missing segment is unhealthy', async () => {
  const result = await probeStream(root, 1000, mockFetch({ [root]: { body: '#EXTM3U\n#EXTINF:4,\nmissing.ts' } }));
  assert.equal(result.ok, false);
  assert.match(result.error, /Segment HTTP 404/);
});
test('empty manifests and HTML media error pages are unhealthy', async () => {
  assert.equal((await probeStream(root, 1000, mockFetch({ [root]: { body: '#EXTM3U' } }))).ok, false);
  const result = await probeStream(root, 1000, mockFetch({
    [root]: { body: '#EXTM3U\n#EXTINF:4,\nerror.ts' },
    'https://example.com/live/error.ts': { body: '<html>Access denied</html>' },
  }));
  assert.equal(result.ok, false);
});
test('generated backups survive parsing and reject malformed or unsafe attributes', () => {
  const backups = ['https://example.com/backup.m3u8?token=a&b=2'];
  const text = formatM3U(['#EXTM3U'], [{ name: 'News', primaryUrl: root, group: 'News', backupUrls: backups }]);
  assert.deepEqual(parseM3U(text)[0].backupUrls, backups);
  assert.equal(parseM3U('#EXTINF:-1 backup-urls="invalid",News\n' + root)[0].backupUrls, undefined);
  const bad = encodeURIComponent(JSON.stringify(['javascript:alert(1)', root]));
  assert.deepEqual(parseM3U(`#EXTINF:-1 backup-urls="${bad}",News\n${root}`)[0].backupUrls, [root]);
});
