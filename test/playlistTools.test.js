import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPolicyViolations } from '../scripts/playlist-tools.mjs';
import { formatM3U } from '../scripts/playlist-tools.mjs';
import { parseM3U } from '../src/parser.js';

test('country language exceptions preserve Ethiopian diaspora IDs and other language restrictions', () => {
  const policy = { rules: { allowedLanguages: ['eng'], languageExemptCountries: ['et', 'tz'] } };
  const ethiopian = { ...channel('EBS', 'Africa'), id: 'EBS.us@HD', country: 'et', languages: ['amh'] };
  assert.deepEqual(findPolicyViolations(ethiopian, policy), []);
  assert.equal(parseM3U(formatM3U(['#EXTM3U'], [ethiopian]))[0].country, 'et');
  assert.deepEqual(findPolicyViolations({ ...ethiopian, country: 'tz', languages: ['swa'] }, policy), []);
  assert.deepEqual(findPolicyViolations({ ...ethiopian, country: 'ke' }, policy), ['channel has no approved language']);
});

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

test('only reviewed soccer entries receive the sports language exception', () => {
  const policy = { rules: { allowedLanguages: ['eng'], languageExemptTags: ['soccer'] } };
  const sports = { ...channel('FIFA+ French', 'Sports'), languages: ['fra'] };
  assert.deepEqual(findPolicyViolations(sports, policy), ['channel has no approved language']);
  assert.deepEqual(findPolicyViolations({ ...sports, contentTags: ['soccer'] }, policy), []);
  assert.deepEqual(findPolicyViolations({ ...sports, contentTags: ['cricket'] }, policy), ['channel has no approved language']);
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
