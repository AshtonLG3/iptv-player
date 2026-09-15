import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const browserSource = readFileSync(
  new URL('../android/src/main/java/com/mangezi/ftaiptv/InAppBrowserActivity.java', import.meta.url),
  'utf8',
);

test('FanCode stays in Rugare embedded WebView on Android', () => {
  assert.doesNotMatch(browserSource, /openFanCodeExternally/);
  assert.match(browserSource, /createWebView\(initialUrl\)/);
  assert.match(browserSource, /isFanCodeUrl\(initialUrl\)/);
  assert.match(browserSource, /replace\("Version\/4\.0 ", ""\)/);
});
