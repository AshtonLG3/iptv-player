import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const browserSource = readFileSync(
  new URL('../android/src/main/java/com/mangezi/ftaiptv/InAppBrowserActivity.java', import.meta.url),
  'utf8',
);

test('FanCode bypasses Rugare embedded WebView on Android', () => {
  assert.match(browserSource, /isFanCodeUrl\(initialUrl\)/);
  assert.match(browserSource, /openFanCodeExternally\(initialUrl\)/);
  assert.match(browserSource, /com\.dream11sportsguru/);
  assert.match(browserSource, /com\.fancode\.tv/);
  assert.match(browserSource, /Intent\.createChooser/);
});
