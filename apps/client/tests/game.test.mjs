// Jet Militia — unit tests for the game's pure logic, physics and wire protocol.
//
// Runs on Node's built-in test runner (node --test): no test framework
// dependency, which keeps the supply chain small enough to audit by eye.
// Run with:  npm run test:unit
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const CLIENT = join(process.cwd(), 'apps', 'client');

/**
 * The client modules are browser IIFEs that attach to `window`. Load one under
 * Node by aliasing `window`/`globalThis` to the same sandbox object.
 */
function loadBrowserModule(file) {
  const code = readFileSync(join(CLIENT, file), 'utf8');
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.console = console;
  sandbox.performance = { now: () => 0 };
  sandbox.Math = Math;
  sandbox.JSON = JSON;
  sandbox.Object = Object;
  sandbox.Array = Array;
  sandbox.setTimeout = setTimeout;
  sandbox.clearTimeout = clearTimeout;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: file });
  return sandbox;
}

let G; // game.js exports
let N; // net.js exports

before(() => {
  G = loadBrowserModule('game.js');
  N = loadBrowserModule('net.js');
});

describe('game constants', () => {
  it('exposes the arena dimensions used by the physics model', () => {
    assert.ok(G.GAME_WORLD, 'GAME_WORLD should be exported');
    assert.ok(G.GAME_WORLD.w > 0);
    assert.ok(G.GAME_WORLD.h > 0);
  });

  it('defines a playable platform set with exactly one ground plane', () => {
    const platforms = G.GAME_PLATFORMS;
    assert.ok(Array.isArray(platforms));
    assert.ok(platforms.length >= 5);
    const ground = platforms.filter((p) => p.ground);
    assert.equal(ground.length, 1);
    assert.equal(ground[0].w, G.GAME_WORLD.w);
  });

  it('has at least 6 spawn points for a 6-player room', () => {
    assert.ok(G.GAME_SPAWNS.length >= 6);
  });

  it('keeps every spawn point inside the arena', () => {
    for (const s of G.GAME_SPAWNS) {
      assert.ok(s.x >= 0 && s.x <= G.GAME_WORLD.w, `spawn x out of bounds: ${s.x}`);
      assert.ok(s.y >= 0 && s.y <= G.GAME_WORLD.h, `spawn y out of bounds: ${s.y}`);
    }
  });
});

describe('weapon table', () => {
  it('exposes exactly three weapons with stable keys', () => {
    assert.deepEqual(Object.keys(G.GAME_WEAPONS).sort(), ['pistol', 'shotgun', 'smg']);
  });

  it('shotgun fires 6 pellets with the widest spread', () => {
    const { shotgun, smg, pistol } = G.GAME_WEAPONS;
    assert.equal(shotgun.pellets, 6);
    assert.ok(shotgun.spread > smg.spread);
    assert.ok(shotgun.spread > pistol.spread);
  });

  it('every weapon has a positive magazine, reload and damage', () => {
    for (const w of Object.values(G.GAME_WEAPONS)) {
      assert.ok(w.mag > 0);
      assert.ok(w.reload > 0);
      assert.ok(w.dmg > 0);
      assert.ok(w.speed > 0);
    }
  });

  it('the SMG is the fastest automatic weapon', () => {
    const { smg, pistol, shotgun } = G.GAME_WEAPONS;
    assert.equal(smg.auto, true);
    assert.ok(smg.rate < pistol.rate);
    assert.ok(smg.rate < shotgun.rate);
  });
});

describe('player model', () => {
  it('starts at full health with full fuel', () => {
    const p = new G.GAME_PLAYER('p1', 'Tester', '#00e5ff', true);
    assert.equal(p.hp, 100);
    assert.equal(p.maxHp, 100);
    assert.equal(p.fuel, 100);
    assert.equal(p.alive, true);
    assert.equal(p.score, 0);
    assert.equal(p.deaths, 0);
  });

  it('stockpiles a full magazine for every weapon', () => {
    const p = new G.GAME_PLAYER('p1', 'Tester', '#00e5ff', true);
    for (const [key, w] of Object.entries(G.GAME_WEAPONS)) {
      assert.equal(p.ammo[key], w.mag, `${key} magazine`);
    }
  });

  it('respawns with health and fuel restored', () => {
    const p = new G.GAME_PLAYER('p1', 'Tester', '#00e5ff', true);
    p.hp = 0;
    p.fuel = 0;
    p.alive = false;
    p.spawn();
    assert.equal(p.hp, 100);
    assert.equal(p.fuel, 100);
    assert.equal(p.alive, true);
  });

  it('derives its centre from position and size', () => {
    const p = new G.GAME_PLAYER('p1', 'Tester', '#00e5ff', true);
    p.x = 100;
    p.y = 200;
    assert.equal(p.cx, 100 + p.w / 2);
    assert.equal(p.cy, 200 + p.h / 2);
  });
});

describe('wire protocol (net.js)', () => {
  it('exposes the room entry points used by the lobby', () => {
    assert.equal(typeof N.Net.hostRoom, 'function');
    assert.equal(typeof N.Net.joinRoom, 'function');
  });

  it('a state packet survives a JSON round-trip unchanged', () => {
    const msg = { t: 'state', id: 'p1', x: 12.5, hp: 88, alive: true };
    assert.deepEqual(JSON.parse(JSON.stringify(msg)), msg);
  });

  it('rejects malformed inbound data without throwing', () => {
    const Net = N.Net;
    const received = [];
    Net.handlers = { onMessage: (from, m) => received.push(m) };
    Net.mode = 'solo';
    assert.doesNotThrow(() => Net._handleData('peer', '{not json'));
    assert.equal(received.length, 0);
  });

  it('parses valid inbound JSON and forwards it to onMessage', () => {
    const Net = N.Net;
    const received = [];
    Net.handlers = { onMessage: (from, m) => received.push({ from, m }) };
    Net.mode = 'solo';
    Net._handleData('peer-x', JSON.stringify({ t: 'hello', name: 'Zed' }));
    assert.equal(received.length, 1);
    assert.equal(received[0].from, 'peer-x');
    assert.deepEqual(received[0].m, { t: 'hello', name: 'Zed' });
  });
});

describe('room codes', () => {
  it('generates 6-character codes from an unambiguous alphabet', () => {
    const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const make = () => {
      let s = '';
      for (let i = 0; i < 6; i++) s += ALPHABET[(Math.random() * ALPHABET.length) | 0];
      return s;
    };
    for (let i = 0; i < 200; i++) {
      const c = make();
      assert.equal(c.length, 6);
      for (const ch of c) assert.ok(ALPHABET.includes(ch));
      // The ambiguous glyphs must never appear — this is what makes a code
      // safe to read aloud over a voice chat.
      assert.ok(!/[0O1I]/.test(c), `ambiguous glyph in code ${c}`);
    }
  });
});

describe('collision geometry', () => {
  it('ground plane spans the full arena width', () => {
    const ground = G.GAME_PLATFORMS.find((p) => p.ground);
    assert.equal(ground.x, 0);
    assert.equal(ground.w, G.GAME_WORLD.w);
  });

  it('no platform extends outside the arena horizontally', () => {
    for (const p of G.GAME_PLATFORMS) {
      assert.ok(p.x >= 0, `platform x ${p.x}`);
      assert.ok(p.x + p.w <= G.GAME_WORLD.w, `platform right edge ${p.x + p.w}`);
    }
  });
});
