import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPolicyViolations } from '../scripts/playlist-tools.mjs';

const registry = {
  rules: {
    allowedGroups: ['Africa', 'Sports', 'Cue Sports'],
    excludedTitlePatterns: ['Spanish'],
    geoRestrictedTitlePatterns: ['Geo-blocked', 'ZA IP only'],
    geoRestrictionExemptGroups: ['Sports', 'Cue Sports'],
  },
};

function channel(name, group) {
  return {
    id: name,
    name,
    group,
    primaryUrl: 'https://example.com/live.m3u8',
    backupUrls: [],
  };
}

test('sports groups are exempt from geo-restriction policy patterns', () => {
  assert.deepEqual(findPolicyViolations(channel('Regional Match [Geo-blocked]', 'Sports'), registry), []);
  assert.deepEqual(findPolicyViolations(channel('Cue Tour [ZA IP only]', 'Cue Sports'), registry), []);
});

test('geo restriction patterns remain blocked outside sports', () => {
  assert.deepEqual(
    findPolicyViolations(channel('Regional News [Geo-blocked]', 'Africa'), registry),
    ['matches geo-restriction pattern: Geo-blocked'],
  );
});

test('sports remain subject to non-territory policy patterns', () => {
  assert.deepEqual(
    findPolicyViolations(channel('Spanish Sports', 'Sports'), registry),
    ['matches excluded pattern: Spanish'],
  );
});
