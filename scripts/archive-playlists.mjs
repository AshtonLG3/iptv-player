import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  HEALTH_PATH,
  PLAYLIST_DIR,
  REGISTRY_PATH,
  playlistPath,
  readJson,
} from './playlist-tools.mjs';

const registry = await readJson(REGISTRY_PATH);
const stamp = new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z');
const archiveDir = path.join(PLAYLIST_DIR, 'archive', stamp);
await mkdir(archiveDir, { recursive: true });

const copied = [];
for (const output of Object.values(registry.outputs)) {
  const source = playlistPath(output.path);
  const destination = path.join(archiveDir, path.basename(output.path));
  await copyFile(source, destination);
  copied.push(path.relative(process.cwd(), destination));
}

await copyIfExists(REGISTRY_PATH, path.join(archiveDir, 'channels.json'), copied);
await copyIfExists(HEALTH_PATH, path.join(archiveDir, 'health.json'), copied);

console.log(`Created playlist archive: ${path.relative(process.cwd(), archiveDir)}`);
for (const file of copied) console.log(`- ${file}`);

async function copyIfExists(source, destination, copiedFiles) {
  try {
    await copyFile(source, destination);
    copiedFiles.push(path.relative(process.cwd(), destination));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
