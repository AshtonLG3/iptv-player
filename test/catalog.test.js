import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMediaSection, groupChannelVariants, getPlaybackSources, describePlaybackError } from '../src/catalog.js';
import { parseM3U } from '../src/parser.js';
import { filterChannelsForUi } from '../src/ui.js';

test('live movie channels stay live while on-demand titles and episodes get their own sections', () => {
  const items = parseM3U('#EXTM3U\n#EXTINF:-1 group-title="Movies",Cinema TV\nhttps://example.com/live.m3u8\n#EXTINF:5400 group-title="Drama",A film\nhttps://example.com/film.m3u8\n#EXTINF:-1 group-title="Series",A show S01E02\nhttps://example.com/episode.mp4');
  assert.deepEqual(items.map(getMediaSection), ['live', 'movie', 'show']);
  assert.equal(filterChannelsForUi(items, { mediaSection: 'movie' }).length, 1);
});

test('quality variants share one channel with lower-bandwidth source first in data saver', () => {
  const channels = groupChannelVariants([
    { name: 'News (1080p)', tvgId: 'News.uk@HD', country: 'uk', url: 'https://example.com/hd.m3u8' },
    { name: 'News (360p)', tvgId: 'News.uk@SD', country: 'uk', url: 'https://example.com/sd.m3u8' },
    { name: 'News (720p)', tvgId: 'News.us', country: 'us', url: 'https://example.com/us.m3u8' },
  ]);
  assert.equal(channels.length, 2);
  assert.equal(channels[0].name, 'News');
  assert.deepEqual(getPlaybackSources(channels[0], 'data-saver'), ['https://example.com/sd.m3u8', 'https://example.com/hd.m3u8']);
});

test('browser interruptions and provider errors give distinct recovery instructions', () => {
  assert.match(describePlaybackError({ name: 'NotAllowedError' }), /tap/);
  assert.match(describePlaybackError({ name: 'AbortError' }), /interrupted/);
  assert.match(describePlaybackError(new Error('manifestLoadError')), /provider/);
  assert.match(describePlaybackError(new Error('HTTP stream blocked on secure page')), /Android/);
});

test('episodes sharing a series id remain separate titles', () => {
  const items = groupChannelVariants([
    { name: 'Series S01E01', tvgId: 'Series', mediaType: 'show', url: 'https://example.com/1.mp4' },
    { name: 'Series S01E02', tvgId: 'Series', mediaType: 'show', url: 'https://example.com/2.mp4' },
  ]);
  assert.equal(items.length, 2);
});
