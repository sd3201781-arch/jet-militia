<!-- Pull request template — see the plan, §1.5. -->
## What does this change?

<!-- One or two sentences. What behaviour changes, and why? -->

## Type

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `perf` — performance
- [ ] `refactor` — no behaviour change
- [ ] `chore` / `docs` / `test`

## Checklist

- [ ] `npm run ci` passes locally (build → validate → size → unit)
- [ ] Touched any `apps/client/*.js`? Confirmed `node --check` is clean.
- [ ] If the wire protocol changed, `net.js` and every consumer were updated together.
- [ ] If the bundle grew, the size budget in `scripts/size-budget.mjs` was deliberately reviewed.
- [ ] No secrets, tokens or API keys in the diff.

## How to test

<!-- Steps a reviewer can follow. Include a room code if it affects multiplayer. -->
