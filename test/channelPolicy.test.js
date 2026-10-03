import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isExcludedRegionalChannel, isEnglishOnlyFeed } from '../scripts/channel-policy.mjs';
test('USA/UK local exception excludes station and regional variants, preserving national feeds', () => {
  for (const [id, name] of [['CBSNewsBoston.us@SD', 'CBS News Boston'], ['KCRA.us@HD', 'NBC 3 Sacramento (KCRA)'], ['LondonLive.uk@SD', 'London Live']]) {
    assert.equal(isExcludedRegionalChannel({ id, name }), true, name);
  }
  assert.equal(isExcludedRegionalChannel({ id: 'BBCOne.uk@East', name: 'BBC One East' }, {}, { is_main: false }), true);
  for (const [id, name] of [['CBSNews.us@SD', 'CBS News 24/7'], ['ABCNewsLive.us@SD', 'ABC News Live'], ['NBCNewsNOW.us@SD', 'NBC News NOW'], ['FoxNews.us@SD', 'Fox News'], ['BBCNews.uk@SD', 'BBC News']]) {
    assert.equal(isExcludedRegionalChannel({ id, name }), false, name);
  }
  assert.equal(isExcludedRegionalChannel({ id: 'ABCNews.au@SD', name: 'ABC News Australia' }), false);
});
test('English filter rejects mixed language and explicit non-English feeds', () => {
  assert.equal(isEnglishOnlyFeed({ name: 'English News' }, { languages: ['eng'] }), true);
  assert.equal(isEnglishOnlyFeed({ name: 'News' }, { languages: ['eng', 'spa'] }), false);
  assert.equal(isEnglishOnlyFeed({ name: 'Cine en espanol' }, { languages: ['eng'] }), false);
  assert.equal(isEnglishOnlyFeed({ name: 'France 24 English' }, { languages: ['eng'] }), true);
});
