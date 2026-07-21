import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAndroidIntentUrl,
  isAndroidUserAgent,
  resolvePlaylistUrl,
  resolveShareablePlaylistUrl,
} from '../src/playlistAccess.js';

test('resolvePlaylistUrl returns an absolute URL from the hosted page', () => {
  assert.equal(
    resolvePlaylistUrl(
      'playlists/english-africa-uk-us-verified.m3u',
      'https://example.com/iptv/index.html',
    ),
    'https://example.com/iptv/playlists/english-africa-uk-us-verified.m3u',
  );
});

test('resolveShareablePlaylistUrl uses public URLs from Android app assets', () => {
  assert.equal(
    resolveShareablePlaylistUrl(
      {
        url: 'playlists/english-africa-uk-us-verified.m3u',
        publicUrl: 'https://raw.githubusercontent.com/example/main.m3u',
      },
      'https://appassets.androidplatform.net/assets/index.html',
    ),
    'https://raw.githubusercontent.com/example/main.m3u',
  );
});

test('createAndroidIntentUrl creates a generic playlist handoff intent', () => {
  const intentUrl = createAndroidIntentUrl(
    'https://example.com/iptv/playlists/main.m3u',
    'https://play.google.com/store/apps/details?id=org.videolan.vlc',
  );

  assert.equal(
    intentUrl,
    'intent://example.com/iptv/playlists/main.m3u#Intent;scheme=https;' +
      'action=android.intent.action.VIEW;type=audio/x-mpegurl;' +
      'S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dorg.videolan.vlc;end',
  );
});

test('isAndroidUserAgent detects Android browsers', () => {
  assert.equal(isAndroidUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel)'), true);
  assert.equal(isAndroidUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), false);
});
