# Jet Militia — Architecture

A short map of how the game is put together, for anyone changing it.

## Shape

Jet Militia is a **static, dependency-light web game**. There is no bundler and
no runtime framework: `apps/client/` is served as authored, and the build step
(`scripts/build.mjs`) only copies it to `_site/` and stamps build metadata.

That is a deliberate choice, not an oversight. The game is small (~60 KB of
hand-written JS), it targets mobile, and every kilobyte of tooling runtime that
is *not* shipped is a kilobyte of cold-start latency that is. The plan's
migration to Vite/TypeScript is tracked as future work; today the pipeline buys
the safety (tests, validation, budgets, security) without the weight.

## Modules

| File | Responsibility |
|---|---|
| `index.html` | Lobby + game shell. Owns all DOM glue and the lobby→game state transition. |
| `style.css` | All UI styling (lobby, HUD chrome, touch controls). |
| `game.js` | The engine: constants, the `Player` class, physics, weapons, damage, respawn, camera, HUD, particles, and the `onNetMessage` reducer. |
| `net.js` | Networking. `Net` is a singleton wrapping either PeerJS room codes or a manual WebRTC offer/answer exchange. Also the single inbound-message funnel. |
| `backgrounds.js` | The modular background system. Each background is an object with `init(w,h)` / `update(dt,t)` / `draw(ctx,w,h,cam)` and a `swatch` colour. |
| `audio.js` | `SFX` — every sound is synthesised with WebAudio. No audio assets to load or validate. |

## The core loop

`Game.loop()` runs on `requestAnimationFrame`:

```
loop(now):
  dt = clamp(now - last, 0, 50ms)     # clamped so a background tab cannot teleport players
  update(dt)                          # simulation
  render()                            # draw
  requestAnimationFrame(loop)
```

`update()` is ordered deliberately: read input → advance local player → integrate
remote players toward their last-known targets → step bullets → step particles →
step floaters/kill-feed → move the camera → emit a state packet (every 50 ms).

## Simulation model

- **Units.** Pixels and seconds. Gravity is `1900 px/s²`, move speed `330 px/s`,
  jet thrust `3000 px/s²`, terminal fall `1250 px/s`.
- **Fuel.** `42/s` while thrusting, `26/s` regeneration, clamped to `[0, 100]`.
  Fuel is what makes the jetpack a resource instead of a flight mode.
- **Movement smoothing.** Horizontal velocity and network interpolation both use
  `lerp(a, b, 1 - pow(k, dt))` — frame-rate independent, so feel is identical at
  30 and 144 Hz. `k` is `1e-4` for local movement (snappy) and `1e-3` for remote
  players (smooth).
- **Collision.** Vertical-only platform collision (one-way platforms). A falling
  body lands on a platform if it crosses the top edge in a single step; the
  30 px tolerance plus a clamped `dt` prevents tunnelling at terminal velocity.
- **Weapons.** Data-driven from `WEAPONS`; each entry carries damage, rate,
  muzzle speed, spread, magazine, reload, pellet count and tracer colour. The
  shotgun fires 6 pellets by setting `pellets: 6` — no special-casing in `fire()`.
- **Randomness.** `Math.random()` is used for spread, particles and spawn choice.
  Deterministic replays would require a seeded RNG; that is tracked in the plan.

## Networking

**Topology: host-authoritative star.** The host is a player *and* the relay. Each
client opens one WebRTC data channel to the host; the host rebroadcasts. Cost is
`O(n)` connections rather than `O(n²)` — the right trade for a 6-player party game.

**Signalling.** PeerJS room codes. The host registers as peer id `jms-<CODE>`, so
the room code *is* the rendezvous point and needs no registry. A manual
offer/answer panel exists as a fallback for 1v1 when the broker is blocked.

**Message types** (all `{ t, ... }` JSON):

| `t` | Direction | Payload |
|---|---|---|
| `hello` | client → host | `{ name, color }` |
| `welcome` | host → client | `{ id, bg, players }` |
| `roster` | host → all | `{ players }` |
| `state` | all | `{ id, x, y, vx, vy, hp, aim, face, alive, jet, weapon, score }` |
| `shoot` | all | `{ id, x, y, aim, weapon }` |
| `hit` | client → host | `{ target, dmg, by }` |
| `die` | host → all | `{ id, by }` |
| `bg` | host → all | `{ bg }` |

Two properties keep this honest:

1. **Remote players are interpolated, never trusted.** A remote player's rendered
   position is `lerp(current, target)`, so a peer sending absurd coordinates
   produces visible teleporting rather than a physics explosion.
2. **The background is host-authoritative.** Switching it sends `{t:"bg"}`, so
   every player sees the same scene. This is why backgrounds must stay
   interchangeable — they cannot carry per-client state.

**Known gaps** (see `docs/CI-CD-PLAN.md`): the host is a browser tab, so host
departure ends the match; there is no server-side validation, so a modified
client can cheat; and ICE is STUN-only, so symmetric-NAT players cannot connect.
The plan's Phases 2–4 address all three.

## Extending it

**A new background** — add an object to `BACKGROUNDS` in `backgrounds.js`:

```js
{
  id: 'nebula',
  name: 'Nebula',
  swatch: '#a06bff',
  init(w, h) { /* allocate particles, stars */ },
  update(dt, t) { /* advance them */ },
  draw(ctx, w, h, cam) { /* paint, using cam.x / cam.y for parallax */ },
}
```

Nothing else needs to change: `index.html` builds the swatch row by iterating
`BACKGROUNDS`, `Game.setBg` looks scenes up by id, and the build validator only
checks that `backgrounds.js` still loads.

**A new weapon** — add an entry to `WEAPONS` in `game.js` and its key to
`WEAPON_ORDER`. The HUD, ammo tracking, reload flow and network payloads are all
driven off that table.

**A new message type** — add a `case` to `Game.onNetMessage`. The host relay is
generic (it rebroadcasts anything it does not recognise) so only sender and
receiver need to agree.
