import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FEATURED_OFFICIAL_SERVICE_IDS,
  OFFICIAL_SERVICES,
} from '../src/constants.js';

test('featured official services keep the requested direct-button order and labels', () => {
  const serviceById = Object.fromEntries(OFFICIAL_SERVICES.map((service) => [service.id, service]));
  const featured = FEATURED_OFFICIAL_SERVICE_IDS.map((id) => serviceById[id]);

  assert.deepEqual(
    featured.map((service) => service.shortLabel),
    ['AfreeTV', 'e+', 'SABC+', 'Z+', 'SportyTV'],
  );
  assert.equal(featured.every((service) => service.url.startsWith('https://')), true);
  assert.equal(
    featured.every((service) => service.logo.startsWith('assets/services/')),
    true,
  );
  assert.deepEqual(
    featured.slice(1).map((service) => service.androidPackage),
    [
      'com.brightcove.evod',
      'tv.sabcplus.vod',
      'com.zbc.ottapp',
      'com.sporty.android',
    ],
  );
  assert.equal(
    featured.slice(1).every((service) => service.androidStoreUrl.includes(service.androidPackage)),
    true,
  );
  assert.equal(
    featured.slice(1).every((service) => !service.url.includes('play.google.com')),
    true,
  );
  assert.equal(featured[0].androidPackage, undefined);
  assert.equal(featured[4].androidPackage, 'com.sporty.android');
  assert.equal(featured[4].androidOnly, undefined);
  assert.equal(featured[4].url, 'https://sporty.com/sporty-tv');
  assert.equal(featured[4].logo, 'assets/services/sportytv.svg');
  assert.equal(
    featured[4].androidDeepLink,
    'sporty-com://com.sporty.android/channel-247',
  );
});
