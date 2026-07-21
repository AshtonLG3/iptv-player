import path from 'node:path';
import {
  findPolicyViolations,
  HEALTH_PATH,
  readJson,
  REGISTRY_PATH,
  registryKey,
  writeJson,
  writeText,
} from './playlist-tools.mjs';

const options = parseArgs(process.argv.slice(2));
const registry = await readJson(REGISTRY_PATH);
const previousHealth = await readJson(HEALTH_PATH, { schemaVersion: 1, channels: {} });
const channels = registry.channels.filter((channel) => channel.status !== 'disabled');
const policyResults = channels.flatMap((channel) => {
  const violations = findPolicyViolations(channel, registry);
  return violations.map((violation) => ({
    channel,
    violation,
  }));
});

const streamResults = await runWithConcurrency(
  channels,
  options.concurrency,
  (channel) => verifyChannel(channel, options.timeoutMs),
);

const nextHealth = {
  schemaVersion: 1,
  updated: new Date().toISOString(),
  channels: {},
};

for (const result of streamResults) {
  const key = registryKey(result.channel);
  const previous = previousHealth.channels?.[key] || {};
  const healthy = result.primary.ok || result.backups.some((backup) => backup.ok);
  nextHealth.channels[key] = {
    name: result.channel.name,
    group: result.channel.group,
    consecutiveFailures: healthy ? 0 : (previous.consecutiveFailures || 0) + 1,
    lastStatus: result.primary.status,
    lastCheckedAt: nextHealth.updated,
    lastOkAt: healthy ? nextHealth.updated : previous.lastOkAt || null,
    lastFailureAt: healthy ? previous.lastFailureAt || null : nextHealth.updated,
    lastWorkingUrl: getLastWorkingUrl(result) || previous.lastWorkingUrl || null,
  };
}

const report = buildReport({
  registry,
  streamResults,
  policyResults,
  health: nextHealth,
  failureThreshold: options.failureThreshold,
});

if (options.reportPath) await writeText(path.resolve(options.reportPath), report.markdown);
if (options.jsonPath) await writeJson(path.resolve(options.jsonPath), report.summary);
if (options.updateHealth) await writeJson(HEALTH_PATH, nextHealth);

console.log(report.consoleSummary);

if (options.failOnUnhealthy && report.summary.unhealthyCount) process.exit(1);
if (options.failOnPolicy && policyResults.length) process.exit(1);
if (options.failOnRepeated && report.summary.repeatedFailureCount) process.exit(1);

async function verifyChannel(channel, timeoutMs) {
  const urls = [channel.primaryUrl, ...(channel.backupUrls || [])].filter(Boolean);
  const [primary, ...backups] = await Promise.all(urls.map((url) => verifyUrl(url, timeoutMs)));
  return { channel, primary, backups };
}

async function verifyUrl(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
      },
    });
    const text = await response.text();
    const probe = text.slice(0, 4096);
    const validPlaylist = /#EXTM3U|#EXT-X-|#EXTINF/.test(probe);
    return {
      url,
      ok: response.ok && validPlaylist,
      status: response.status,
      elapsedMs: Date.now() - started,
      finalUrl: response.url,
      redirected: response.url !== url,
      bytes: text.length,
      validPlaylist,
    };
  } catch (error) {
    return {
      url,
      ok: false,
      status: error.name === 'AbortError' ? 'TIMEOUT' : 'ERROR',
      elapsedMs: Date.now() - started,
      finalUrl: url,
      redirected: false,
      bytes: 0,
      validPlaylist: false,
      error: error.message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()),
  );
  return results;
}

function buildReport({ registry, streamResults, policyResults, health, failureThreshold }) {
  const unhealthy = streamResults.filter(
    (result) => !result.primary.ok && !result.backups.some((backup) => backup.ok),
  );
  const backupRecoverable = streamResults.filter(
    (result) => !result.primary.ok && result.backups.some((backup) => backup.ok),
  );
  const redirects = streamResults.filter(
    (result) => result.primary.ok && result.primary.redirected,
  );
  const repeatedFailures = unhealthy.filter((result) => {
    const key = registryKey(result.channel);
    return (health.channels[key]?.consecutiveFailures || 0) >= failureThreshold;
  });

  const lines = [
    '# Playlist Health Report',
    '',
    'Mode: report-only; channels are never disabled automatically, and a later healthy response resets consecutive failures.',
    '',
    `Checked: ${new Date().toISOString()}`,
    `Registry channels: ${registry.channels.length}`,
    `Active channels checked: ${streamResults.length}`,
    `Unhealthy channels: ${unhealthy.length}`,
    `Policy violations: ${policyResults.length}`,
    `Backup-recoverable channels: ${backupRecoverable.length}`,
    `Redirected primary URLs: ${redirects.length}`,
    '',
  ];

  if (policyResults.length) {
    lines.push('## Policy Violations', '');
    for (const { channel, violation } of policyResults) {
      lines.push(`- ${channel.name} (${channel.id || channel.primaryUrl}): ${violation}`);
    }
    lines.push('');
  }

  if (unhealthy.length) {
    lines.push('## Unhealthy Streams', '');
    for (const result of unhealthy) {
      const key = registryKey(result.channel);
      const consecutive = health.channels[key]?.consecutiveFailures || 0;
      lines.push(
        `- ${result.channel.name} (${result.channel.group}): ${result.primary.status}, ` +
          `${result.primary.elapsedMs}ms, failures=${consecutive}`,
      );
    }
    lines.push('');
  }

  if (repeatedFailures.length) {
    lines.push(`## Repeated Failures (${failureThreshold}+ checks)`, '');
    for (const result of repeatedFailures) {
      const key = registryKey(result.channel);
      const consecutive = health.channels[key]?.consecutiveFailures || 0;
      lines.push(`- ${result.channel.name} (${result.channel.group}): failures=${consecutive}`);
    }
    lines.push('');
  }

  if (backupRecoverable.length) {
    lines.push('## Backup Restore Candidates', '');
    for (const result of backupRecoverable) {
      const backup = result.backups.find((candidate) => candidate.ok);
      lines.push(`- ${result.channel.name}: primary failed, backup works: ${backup.url}`);
    }
    lines.push('');
  }

  if (redirects.length) {
    lines.push('## Redirected Primary URLs', '');
    for (const result of redirects) {
      lines.push(`- ${result.channel.name}: ${result.primary.url} -> ${result.primary.finalUrl}`);
    }
    lines.push('');
  }

  const summary = {
    checkedAt: new Date().toISOString(),
    activeCount: streamResults.length,
    unhealthyCount: unhealthy.length,
    policyViolationCount: policyResults.length,
    backupRecoverableCount: backupRecoverable.length,
    redirectedCount: redirects.length,
    repeatedFailureCount: repeatedFailures.length,
  };

  return {
    markdown: `${lines.join('\n').trimEnd()}\n`,
    summary,
    consoleSummary:
      `Checked ${summary.activeCount} channels. ` +
      `Unhealthy=${summary.unhealthyCount}, policy=${summary.policyViolationCount}, ` +
      `backupRecoverable=${summary.backupRecoverableCount}, redirects=${summary.redirectedCount}, ` +
      `repeated=${summary.repeatedFailureCount}.`,
  };
}

function getLastWorkingUrl(result) {
  if (result.primary.ok) return result.primary.finalUrl || result.primary.url;
  const backup = result.backups.find((candidate) => candidate.ok);
  return backup?.finalUrl || backup?.url || null;
}

function parseArgs(args) {
  const options = {
    concurrency: 10,
    timeoutMs: 12000,
    failureThreshold: 3,
    reportPath: null,
    jsonPath: null,
    updateHealth: false,
    failOnUnhealthy: false,
    failOnPolicy: true,
    failOnRepeated: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--concurrency') options.concurrency = Number(args[++i]);
    else if (arg === '--timeout') options.timeoutMs = Number(args[++i]);
    else if (arg === '--failure-threshold') options.failureThreshold = Number(args[++i]);
    else if (arg === '--report') options.reportPath = args[++i];
    else if (arg === '--json') options.jsonPath = args[++i];
    else if (arg === '--update-health') options.updateHealth = true;
    else if (arg === '--fail-on-unhealthy') options.failOnUnhealthy = true;
    else if (arg === '--fail-on-repeated') options.failOnRepeated = true;
    else if (arg === '--no-fail-on-policy') options.failOnPolicy = false;
  }

  return options;
}
