# 🚀 Jet Militia

**A 2D online multiplayer jetpack arena shooter — built as a dependency-light static web game, shipped through a real CI/CD pipeline.**

[![Play now](https://img.shields.io/badge/%E2%96%B6%20Play%20now-jet--militia-2ea043?style=for-the-badge)](https://sd3201781-arch.github.io/jet-militia/)
[![Deploy to GitHub Pages](https://github.com/sd3201781-arch/jet-militia/actions/workflows/pages.yml/badge.svg)](https://github.com/sd3201781-arch/jet-militia/actions/workflows/pages.yml)
[![CI](https://github.com/sd3201781-arch/jet-militia/actions/workflows/ci.yml/badge.svg)](https://github.com/sd3201781-arch/jet-militia/actions/workflows/ci.yml)
![players](https://img.shields.io/badge/players-1%E2%80%936-ff6a1a?style=for-the-badge)
![license](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)

---

## ▶️ Play it live

**👉 https://sd3201781-arch.github.io/jet-militia/**

Jet Militia is a **2D side-view arena shooter** inspired by *Doodle Army 2: Mini Militia* — rocket-jetpack flight, gravity, platforms, three weapons, health, respawn and a live scoreboard. It plays **online in real time** over WebRTC (peer-to-peer, no game server required) with a **room-code / invite-link lobby** for up to **6 players**, and ships with **two switchable backgrounds** (a lava **Inferno** and a neon **Cyberpunk City**).

Works on desktop and mobile — no install, no login.

---

## 🎮 Controls

| Action | Desktop | Mobile |
|---|---|---|
| Move | `A` / `D` or `←` / `→` | left thumb (drag) |
| Jetpack | `W` / `↑` / `Space` | left thumb (push up) |
| Aim | mouse | right thumb (drag) |
| Shoot | click / hold | right thumb (push out) |
| Swap weapon | `1` / `2` / `3` or `Q` | — |
| Reload | `R` | — |
| Switch background | `B` | top-bar swatches |
| Scoreboard | `Tab` | 🏆 SCORES button |

**Weapons:** Pistol (precise, 20 dmg) · SMG (fast auto, 9 dmg) · Shotgun (6 pellets, 12 dmg each). Each has its own magazine and reload.

## 🌐 Start / join a multiplayer match

1. **Host** — enter a callsign, press **🛰 HOST A ROOM**. A 6-character room code appears.
2. **Share** — press **🔗 COPY INVITE LINK** (or **📋 COPY CODE**) and send it to friends.
3. **Join** — friends open the link (it auto-fills the code) or type the code and press **JOIN**.
4. **Start** — the host presses **▶ START MATCH**. Up to 6 players per room.

Multiplayer is **host-authoritative peer-to-peer** over WebRTC data channels (signalling via PeerJS). An **Advanced → manual WebRTC** panel provides a copy/paste offer/answer fallback for 1v1 when the signalling broker is blocked.

## 🎨 Backgrounds

Two fully modular scenes — click the swatches in the top bar or press **B**:

1. **🔥 Inferno** — lava and embers, glowing orange-red, animated flames, drifting smoke, volcano silhouettes, parallax.
2. **🌃 Neon City** — cyberpunk skyline with 3-layer parallax, glowing windows, rain, a purple moon and neon haze.

Backgrounds live in [`apps/client/backgrounds.js`](apps/client/backgrounds.js) as self-contained objects with a shared interface (`init / update / draw`). A new scene is a drop-in: add an object and push it into the `BACKGROUNDS` array.

---

## 🧱 Architecture

```
apps/client/          the game — ships as-is to the CDN, no bundler
├─ index.html         lobby + game shell + glue
├─ style.css          UI
├─ backgrounds.js     modular background system (Inferno, Neon City)
├─ audio.js           WebAudio-synthesised SFX (no audio files)
├─ net.js             WebRTC networking (PeerJS room codes + manual fallback)
├─ game.js            core engine (physics, jetpack, weapons, damage, respawn, HUD)
   (peerjs.min.js is vendored in at build time from the pinned npm dependency)

scripts/              build + release tooling
├─ build.mjs          copies apps/client → _site, writes build-meta.json
├─ validate-assets.mjs asserts no broken refs can ship (catches 404s pre-deploy)
├─ size-budget.mjs    fails CI if a bundle regresses past its budget
└─ serve.mjs          local play-test server

.github/workflows/    the pipeline
├─ ci.yml             lint → unit → build → security
└─ pages.yml          build → deploy → GitHub Pages

docs/                 engineering documentation
```

## 🔁 CI/CD pipeline

Every pull request and every push to `main` runs:

| Stage | Job | What it enforces |
|---|---|---|
| 1 | `lint` | `node --check` on every game module, JSON/YAML well-formed, no committed secrets |
| 2 | `unit` | `node --test` suite over weapons, player model, physics, collision and the wire protocol |
| 3 | `build` | Builds `_site/`, **validates assets** (no 404s possible), **enforces the size budget** |
| 4 | `security` | `npm audit`, gitleaks secrets scan, CodeQL SAST, CycloneDX SBOM |
| 5 | `deploy` | Publishes the **CI-built artifact** to GitHub Pages |

Any red stage blocks the merge. The deployed site is always exactly the artifact that passed the pipeline.

### Versioning

Each build writes `_site/build-meta.json` with a release id of the form
`v<semver>+<short-sha>` (e.g. `v1.0.0+a3f9c21`) — enough to tie a support report to an exact build.

## 🛠️ Run it locally

```bash
git clone https://github.com/sd3201781-arch/jet-militia.git
cd jet-militia
npm install

npm run start        # build + serve at http://localhost:5173
npm run ci           # exactly what CI runs: build → validate → size → unit tests
```

Individual steps: `npm run build`, `npm run validate`, `npm run size`, `npm run test:unit`.

## 🗺️ Roadmap

This repository implements the **foundation, pipeline, testing and delivery** layers of the Jet Militia CI/CD plan. The remaining phases (its own signalling service, TURN relay for NAT-restricted players, host migration, observability, and an authoritative game server with client-side prediction) are specified in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

The highest-impact open item is **TURN**: today's STUN-only ICE means a meaningful share of players behind symmetric NATs or corporate firewalls cannot connect.

## 📄 License

[MIT](LICENSE) — do what you like, no warranty.

---

*Inspired by the genre classic Doodle Army 2: Mini Militia. Not affiliated with Appsomniacs or Miniclip.*
