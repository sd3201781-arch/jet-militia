#!/usr/bin/env node
/**
 * Jet Militia — build step.
 *
 * The client is dependency-light hand-authored ES/IIFE + Canvas 2D, so this is
 * intentionally a small, auditable, zero-dependency builder rather than a
 * bundler. It is the single source of truth for what gets deployed, so that
 * CI/CD, Pages and local dev all produce byte-identical output.
 *
 *   apps/client/**  ->  _site/**
 *
 * Versioning follows the plan: v<semver>+<short-sha>.
 */
import { readdirSync, statSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const ROOT = resolve(process.cwd());
const SRC = join(ROOT, 'apps', 'client');
const OUT = join(ROOT, '_site');

// Directories that are development-only and must never reach the CDN.
const EXCLUDE_DIRS = new Set(['tests', 'node_modules', '.git']);
const EXCLUDE_FILES = new Set([]);

// PeerJS is a real, audited npm dependency (it used to be vendored by hand —
// the plan flags that as a supply-chain blind spot: a hand-copied library is
// invisible to `npm audit`, Dependabot and the SBOM). The build vendors the
// browser UMD bundle out of node_modules so the client can keep loading it
// with a plain <script src>, while the version stays pinned in package.json.
const VENDOR = [
  {
    from: join(ROOT, 'node_modules', 'peerjs', 'dist', 'peerjs.min.js'),
    to: 'peerjs.min.js',
  },
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(name) || EXCLUDE_FILES.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function sha() {
  return (process.env.GITHUB_SHA || 'dev').slice(0, 7);
}

function main() {
  if (!existsSync(SRC)) {
    console.error(`✗ source directory not found: ${SRC}`);
    process.exit(1);
  }

  mkdirSync(OUT, { recursive: true });

  const files = walk(SRC);
  for (const f of files) {
    const rel = relative(SRC, f);
    const dest = join(OUT, rel);
    mkdirSync(join(dest, '..'), { recursive: true });
    copyFileSync(f, dest);
  }

  // Vendor the pinned browser bundle of each third-party dependency.
  for (const v of VENDOR) {
    if (!existsSync(v.from)) {
      console.error('✗ vendored dependency missing: ' + v.from + ' — run npm ci first.');
      process.exit(1);
    }
    const dest = join(OUT, v.to);
    mkdirSync(join(dest, '..'), { recursive: true });
    copyFileSync(v.from, dest);
    files.push(dest);
  }

  const pkg = JSON.parse(readFileSyncSafe(join(ROOT, 'package.json')));
  const meta = {
    name: pkg.name,
    version: pkg.version,
    release: `v${pkg.version}+${sha()}`,
    protocolVersion: 1,
    sha: process.env.GITHUB_SHA || 'dev',
    ref: process.env.GITHUB_REF || 'local',
    builtAt: new Date().toISOString(),
    files: files.length,
  };
  writeFileSync(join(OUT, 'build-meta.json'), JSON.stringify(meta, null, 2) + String.fromCharCode(10));

  console.log(`✓ built ${files.length} files -> _site/  (release ${meta.release})`);
}

function readFileSyncSafe(p) {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return '{"name":"jet-militia","version":"0.0.0"}';
  }
}

main();
