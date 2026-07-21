import path from 'node:path';
import {
  findPolicyViolations,
  formatM3U,
  playlistPath,
  readJson,
  readText,
  REGISTRY_PATH,
  uniqueByUrl,
  writeText,
} from './playlist-tools.mjs';

const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');

const registry = await readJson(REGISTRY_PATH);
const activeChannels = registry.channels.filter((channel) => channel.status !== 'disabled');
const policyViolations = activeChannels.flatMap((channel) => {
  const violations = findPolicyViolations(channel, registry);
  return violations.map((violation) => `${channel.name}: ${violation}`);
});

if (policyViolations.length) {
  console.error('Playlist policy violations found:');
  for (const violation of policyViolations) console.error(`- ${violation}`);
  process.exit(1);
}

let mismatchCount = 0;

for (const [outputName, output] of Object.entries(registry.outputs)) {
  const channels = uniqueByUrl(
    activeChannels.filter((channel) => channel.outputs.includes(outputName)),
  );
  const text = formatM3U(output.header, channels);
  const outputPath = playlistPath(output.path);

  if (checkOnly) {
    const current = await readText(outputPath);
    if (normalizeNewlines(current) !== normalizeNewlines(text)) {
      console.error(`${output.path} is not in sync with playlists/channels.json`);
      mismatchCount += 1;
    }
    continue;
  }

  await writeText(outputPath, text);
  console.log(`Generated ${channels.length} entries in ${path.relative(process.cwd(), outputPath)}`);
}

if (mismatchCount) process.exit(1);
if (checkOnly) console.log('Generated playlists match playlists/channels.json');

function normalizeNewlines(text) {
  return text.replace(/\r\n/g, '\n').trimEnd();
}
