import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FEATURED_OFFICIAL_SERVICE_IDS,
  OFFICIAL_SERVICES,
  INSTALLED_SPORTS_APPS,
} from '../src/constants.js';

test('featured official services keep the requested direct-button order and labels', () => {
  const serviceById = Object.fromEntries(OFFICIAL_SERVICES.map((service) => [service.id, service]));
  const featured = FEATURED_OFFICIAL_SERVICE_IDS.map((id) => serviceById[id]);

  assert.deepEqual(
    featured.map((service) => service.shortLabel || service.name),
    ['AfreeTV', 'e+', 'SABC+', 'Z+', 'SportyTV', 'TNT Sports 1–4',
      'beIN SPORTS CONNECT', 'Sky Sports Cricket', 'FanCode', 'TSN 1–5', 'A Sports'],
  );
  assert.equal(featured.every((service) => service.url.startsWith('https://')), true);
  assert.equal(
    featured.every((service) => !service.logo || service.logo.startsWith('assets/services/')),
    true,
  );

  assert.equal(featured.filter((service) => service.externalBrowser)
    .every((service) => Boolean(service.accessLabel)), true);
  assert.equal(OFFICIAL_SERVICES.some((service) => service.id === 'cricfy'), false);
  assert.equal(INSTALLED_SPORTS_APPS[0].androidPackage, 'com.cricfytv.sports');
  assert.match(INSTALLED_SPORTS_APPS[0].accessLabel, /third-party/);

  const nativeFeatured = featured.filter((service) => service.androidPackage);
  assert.deepEqual(
    nativeFeatured.map((service) => service.androidPackage),
    [
      'com.brightcove.evod',
      'tv.sabcplus.vod',
      'com.zbc.ottapp',
      'com.sporty.android',
    ],
  );
  assert.equal(
    nativeFeatured.every((service) => service.androidStoreUrl.includes(service.androidPackage)),
    true,
  );
  assert.equal(
    nativeFeatured.every((service) => !service.url.includes('play.google.com')),
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
