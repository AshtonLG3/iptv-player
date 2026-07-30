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
    featured.slice(0, 4).every((service) => service.logo.startsWith('assets/services/')),
    true,
  );
  assert.equal(featured[4].androidPackage, 'com.sporty.android');
  assert.equal(
    featured[4].androidDeepLink,
    'sporty-com://com.sporty.android/channel-247',
  );
});
