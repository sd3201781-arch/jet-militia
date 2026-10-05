#!/usr/bin/env node
/**
 * Size budget — the plan's §3.5 guard rail.
 *
 * Jet Militia targets mobile touch players. A 4 s cold start on 3G loses the
 * player before they ever see the arena, so a bundle regression must be a CI
 * failure, not a churn metric.
 *
 * Budgets are measured on the *shipped* files in _site/. The vendored
 * peerjs.min.js is tracked separately so a game-code change cannot hide behind
 * it (see the plan: de-vendoring it to an npm dependency is tracked work).
 */
import { readFileSync, statSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, resolve } from 'node:path';

const SITE = join(resolve(process.cwd()), '_site');
const KB = 1024;

const BUDGETS = [
  { name: 'game engine (game.js, gzip)', file: 'game.js', limit: 12 },
  { name: 'backgrounds (backgrounds.js, gzip)', file: 'backgrounds.js', limit: 4 },
  { name: 'networking (net.js, gzip)', file: 'net.js', limit: 4 },
  { name: 'audio (audio.js, gzip)', file: 'audio.js', limit: 3 },
  { name: 'styles (style.css, gzip)', file: 'style.css', limit: 4 },
  { name: 'shell (index.html, gzip)', file: 'index.html', limit: 12 },
  { name: 'vendor (peerjs.min.js, gzip)', file: 'peerjs.min.js', limit: 50 },
];

let failed = false;
const rows = [];

for (const b of BUDGETS) {
  const p = join(SITE, b.file);
  if (!existsSync(p)) {
    console.error(`✗ missing build output: ${b.file}`);
    failed = true;
    continue;
  }
  const raw = readFileSync(p);
  const gz = gzipSync(raw, { level: 9 }).length;
  const gzKb = gz / KB;
  const over = gzKb > b.limit;
  if (over) failed = true;
  rows.push({
    name: b.name,
    raw: (raw.length / KB).toFixed(1),
    gzip: gzKb.toFixed(2),
    limit: b.limit.toFixed(0),
    status: over ? 'OVER' : 'ok',
  });
}

const totalGzip = BUDGETS.reduce((sum, b) => {
  const p = join(SITE, b.file);
  return existsSync(p) ? sum + gzipSync(readFileSync(p), { level: 9 }).length : sum;
}, 0);

console.log('');
console.log('  Size budget (gzipped)');
console.log('');
console.log('  ' + 'asset'.padEnd(42) + 'raw kB'.padEnd(9) + 'gzip kB'.padEnd(10) + 'limit'.padEnd(7) + 'status');
console.log('  ' + '-'.repeat(74));
for (const r of rows) {
  console.log(
    '  ' +
      r.name.padEnd(42) +
      r.raw.padEnd(9) +
      r.gzip.padEnd(10) +
      r.limit.padEnd(7) +
      r.status
  );
}
console.log('  ' + '-'.repeat(74));
console.log('  ' + 'TOTAL (gzip)'.padEnd(42) + ''.padEnd(9) + (totalGzip / KB).toFixed(2) + ' kB');
console.log('');

if (failed) {
  console.error('✗ Size budget exceeded — trim the change or raise the budget deliberately.');
  process.exit(1);
}
console.log('✓ All assets within budget');
console.log('');
