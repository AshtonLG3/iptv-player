import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const MODULE_SOURCES = [
  'app.js',
  'src/parser.js',
  'src/playlist.js',
  'src/ui.js',
];

test('browser module graph uses one cache token for an atomic release', async () => {
  const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const entryMatch = indexHtml.match(/src="app\.js\?v=([^"]+)"/);
  assert.ok(entryMatch, 'index.html must cache-bust the app entry module');
  const releaseToken = entryMatch[1];

  for (const relativePath of MODULE_SOURCES) {
    const source = await readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
    const imports = [...source.matchAll(/from\s+['"](\.[^'"]+\.js(?:\?[^'"]*)?)['"]/g)];
    assert.ok(imports.length > 0, `${relativePath} should contain browser module imports`);
    for (const [, importUrl] of imports) {
      assert.equal(
        importUrl.endsWith(`?v=${releaseToken}`),
        true,
        `${relativePath} import ${importUrl} must use release token ${releaseToken}`,
      );
    }
  }
});
