#!/usr/bin/env node
/**
 * Asset validation — catch 404s before players do.
 *
 * A build that references a missing script is a *runtime* failure that unit
 * tests cannot see. This validator asserts:
 *   1. every source file made it into the build output;
 *   2. every local src/href in index.html resolves to a real file;
 *   3. every <script src> resolves;
 *   4. no hosting-injected shim leaked back into the shipped HTML.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const ROOT = resolve(process.cwd());
const SRC = join(ROOT, 'apps', 'client');
const SITE = join(ROOT, '_site');

const errors = [];
const EXCLUDE_DIRS = new Set(['tests', 'node_modules', '.git']);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(relative(SRC, p));
  }
  return out;
}

if (!existsSync(join(SITE, 'index.html'))) {
  console.error('✗ _site/index.html not found — run `npm run build` first.');
  process.exit(1);
}

// 1 ─ every source file present in the output
const sourceFiles = walk(SRC);
for (const f of sourceFiles) {
  if (!existsSync(join(SITE, f))) errors.push(`missing in build output: ${f}`);
}

const html = readFileSync(join(SITE, 'index.html'), 'utf8');

// 2 ─ every local src/href resolves
const isExternal = (u) =>
  u.startsWith('http:') ||
  u.startsWith('https:') ||
  u.startsWith('//') ||
  u.startsWith('data:') ||
  u.startsWith('#') ||
  u.startsWith('mailto:');
const stripSlash = (s) => (s.startsWith('/') ? s.slice(1) : s);

const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((u) => !isExternal(u));

for (const r of refs) {
  const clean = stripSlash(r.split('?')[0].split('#')[0]);
  if (clean && !existsSync(join(SITE, clean))) {
    errors.push(`index.html references a missing file: ${r}`);
  }
}

// 3 ─ explicit script tags
const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
for (const s of scripts) {
  const clean = stripSlash(s.split('?')[0]);
  if (!existsSync(join(SITE, clean))) errors.push(`missing script: ${s}`);
}

// 4 ─ no hosting shim leaked in
if (html.includes('data-tmly-media-guard')) {
  errors.push('index.html still contains the hosting-injected media guard');
}

// 5 ─ the game's own modules must be loaded, in dependency order
const REQUIRED = ['peerjs.min.js', 'backgrounds.js', 'audio.js', 'net.js', 'game.js'];
for (const r of REQUIRED) {
  if (!scripts.some((s) => s.endsWith(r))) errors.push(`index.html does not load ${r}`);
}
const idx = (f) => scripts.findIndex((s) => s.endsWith(f));
for (let i = 1; i < REQUIRED.length; i++) {
  if (idx(REQUIRED[i - 1]) > idx(REQUIRED[i])) {
    errors.push(`script order broken: ${REQUIRED[i - 1]} must load before ${REQUIRED[i]}`);
  }
}

if (errors.length) {
  const NL = String.fromCharCode(10);
  console.error('✗ Asset validation failed:' + NL + errors.map((e) => '   - ' + e).join(NL));
  process.exit(1);
}

console.log(
  `✓ Asset validation passed (${sourceFiles.length} files, ${refs.length} HTML refs, ${scripts.length} scripts)`
);
