// Check the media behind HLS manifests, rather than accepting an HTTP 200 alone.
export async function probeStream(url, timeoutMs = 10000, fetchImpl = fetch) {
  const signal = AbortSignal.timeout(timeoutMs);
  let status = 'ERROR';
  let finalUrl = url;
  let entryUrl = url;
  const started = Date.now();
  try {
    let manifest;
    for (let depth = 0; depth < 4; depth += 1) {
      const response = await fetchImpl(finalUrl, { signal });
      status = response.status;
      finalUrl = response.url || finalUrl;
      if (depth === 0) entryUrl = finalUrl;
      if (!response.ok) throw new Error(`Manifest HTTP ${status}`);
      manifest = await response.text();
      if (!manifest.trimStart().startsWith('#EXTM3U')) throw new Error('Not an HLS playlist');
      const lines = manifest.split(/\r?\n/).map((line) => line.trim());
      const variant = lines.findIndex((line) => line.startsWith('#EXT-X-STREAM-INF:'));
      if (variant < 0) break;
      const child = lines.slice(variant + 1).find((line) => line && !line.startsWith('#'));
      if (!child) throw new Error('Master playlist has no rendition');
      finalUrl = new URL(child, finalUrl).href;
      if (depth === 3) throw new Error('Too many nested manifests');
    }
    const lines = manifest.split(/\r?\n/).map((line) => line.trim());
    const media = lines.filter((line) => line && !line.startsWith('#'));
    if (!manifest.includes('#EXTINF:') || !media.length) throw new Error('No media segments');
    // Validate an encryption key when present; unavailable keys also break playback.
    const key = lines.find((line) => line.startsWith('#EXT-X-KEY:') && !line.includes('METHOD=NONE'));
    if (key) {
      const keyUri = key.match(/URI="([^"]+)"/)?.[1];
      if (!key.includes('METHOD=AES-128') || !keyUri) throw new Error('Unsupported encrypted stream');
      const response = await fetchImpl(new URL(keyUri, finalUrl).href, { signal });
      if (!response.ok || (await response.arrayBuffer()).byteLength !== 16) throw new Error('Unavailable AES key');
    }
    const segmentUrl = new URL(media[Math.max(0, media.length - 2)], finalUrl).href;
    const segment = await fetchImpl(segmentUrl, { signal, headers: { Range: 'bytes=0-4095' } });
    if (!segment.ok) throw new Error(`Segment HTTP ${segment.status}`);
    const reader = segment.body.getReader();
    const { value } = await reader.read();
    await reader.cancel();
    if (!value?.length) throw new Error('Empty media segment');
    const prefix = new TextDecoder().decode(value.slice(0, 100)).trimStart();
    if (/^(<!doctype|<html|\{)/i.test(prefix)) throw new Error('Media URL returned an error page');
    return { url, ok: true, status, finalUrl: entryUrl, mediaPlaylistUrl: finalUrl, segmentUrl, segmentBytes: value.length, validPlaylist: true, elapsedMs: Date.now() - started };
  } catch (error) {
    return { url, ok: false, status: signal.aborted ? 'TIMEOUT' : status, finalUrl, validPlaylist: false, error: error.message, elapsedMs: Date.now() - started };
  }
}

export async function mapConcurrent(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
}
