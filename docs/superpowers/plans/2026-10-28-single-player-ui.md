# Black Queen Single-Player Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mobile-first, installable web app where the user plays Black Queen in seat 1 against simple bots, with a scoreboard saved on the device.

**Architecture:** Plain JS modules that work in Node (tests) and in the browser (script tags, shared `BQ` namespace). `blackqueen.js` holds the rules; `bot.js` decides bot moves from `Game.viewFor(seat)` only; `session.js` drives a `Game` with bots and timers; `render.js` turns state into HTML strings (testable without a DOM); `app.js` wires DOM events. A service worker and manifest make it a PWA hosted on GitHub Pages.

**Tech Stack:** HTML, CSS, vanilla JS, Node v26 (`node:test`, `node:assert`) for tests. No framework, no backend, no runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-28-single-player-ui-design.md` (rules in `rules.md`, mockup in `docs/superpowers/specs/mockup/blackqueen-mockup.html`)

## Global Constraints

- Rules are confirmed and fixed: cards per player = floor(52/n); leftovers removed lowest first in order 2D 2C 2H 2S 3D 3C 3H 3S 4D 4C 4H 4S; points A/K/Q/J/10 = 10, 5 = 5, QS = 25, total 235; bids 70 (n=5) or 75 (n>=6) to 125 step 5; 125 ends bidding; all pass means the last player takes the minimum bid; partners = floor((n-3)/2); team points >= bid is a success.
- Scoring: success gives the bidder and every partner +bid (once each), opponents 0; failure gives the bidder -bid, everyone else 0.
- UI offers 5 to 9 players. User is seat 0, bots are seats 1..n-1. Bot names fixed per seat: `Asha, Dev, Mira, Kabir, Zoya, Rohan, Priya, Sam`.
- Mobile first. Phone cards at least 60 x 88 px, hand in rows of at most 5. Tap once to lift a card, tap again (or a Play button) to play it. Illegal cards are dimmed and cannot be selected. Desktop (>= 900 px wide) uses larger cards in one row; single click versus tap-twice there is the builder's choice.
- Never show another player's hand, and never reveal a partner before their partner card is played (`view.revealedPartners`).
- Bots may only use what `Game.viewFor(seat)` returns.
- Every source file's body is wrapped in an IIFE and exports with this pattern, so classic `<script>` tags do not collide on top-level names and Node `require` works:
  ```js
  (function (root) {
    const bq = typeof require === 'function' ? require('./blackqueen') : root.BQ; // dependency, if any
    // ... code ...
    const api = { /* exports */ };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.BQ = Object.assign(root.BQ || {}, api);
  })(typeof globalThis !== 'undefined' ? globalThis : this);
  ```
- Relative paths only (`./`), service-worker scope `./`, so the site works under the GitHub Pages sub-path `/black-queen/`.
- Node is at `/opt/homebrew/bin/node`; run `export PATH=/opt/homebrew/bin:$PATH` first in each shell. Tests: `node test.js` from the project folder `/Users/ravindragaikwad/Desktop/Ravi/black-queen`.
- Commit messages end with the attribution line the harness specifies for this session. Never push without the user's confirmation (Task 8).

## Review Focus

Spec-implied cases no obvious test would cover, each pinned by a test in the named task:

1. Everyone passes: the last player takes the minimum bid, including when that is the user (Task 1 game test, Task 4 session test).
2. Bidder holds every named partner card: team of one, bidder scored +bid once (Task 1).
3. Saved scoreboard missing, unreadable, corrupt JSON or wrong shape: app starts with a fresh scoreboard instead of crashing (Task 3).
4. Saved scoreboard exists for a different player count: never mixed; the user is asked to reset (Tasks 3 and 5).
5. Taps while it is not the user's turn or during the post-trick pause: nothing is played and the game state is unchanged (Tasks 4 and 5).
6. A 10-card hand (5 players) lays out as two rows of 5, a 5-card hand (9 players) as one row (Task 5).

## File Structure

```
blackqueen.js        rules engine (modify: IIFE+export pattern, pure helpers, lastTrick, you)
bot.js               simple bot: botBid, botDeclare, botPlay
scoreboard.js        names, running totals, localStorage save/load
session.js           Session: drives Game + bots + timers for one round
render.js            pure HTML-string renderers
app.js               DOM wiring, screen state, scoreboard recording
index.html styles.css manifest.webmanifest sw.js icons/ tools/make-icons.js
test.js              runner: requires every tests/*.test.js
tests/*.test.js      node:test suites
```

---

### Task 1: Engine ready for browser and UI

**Files:**
- Create: `.gitignore` (`.DS_Store`, `.superpowers/`, `node_modules/`), `test.js`, `tests/game.test.js`
- Modify: `blackqueen.js`

**Interfaces:**
- Produces (added to exports, also on `BQ` in browsers):
  - `legalCards(hand: string[], trick: {player:number, card:string}[]): string[]`
  - `trickWinner(trick: {player,card}[], trump: string): number` (seat; works on partial tricks)
  - `scoreRound({ bid:number, bidder:number, team:number[], captured:number[], n:number }): { teamPoints:number, success:boolean, scores:number[] }`
  - `Game.lastTrick: null | { cards:{player,card}[], winner:number, points:number }`, set when a trick completes
  - `Game.viewFor(p)` additionally returns `you: p` and `lastTrick`
- `Game.legalCards`, `_resolveTrick` and `_finish` delegate to the pure helpers; behaviour otherwise unchanged.

- [ ] **Step 1:** In `/Users/ravindragaikwad/Desktop/Ravi/black-queen`, run `git init -b main`, create `.gitignore`, and make `test.js` a runner that `require`s every file in `tests/` ending `.test.js`.
- [ ] **Step 2: Write failing tests in `tests/game.test.js`** (`node:test`, `assert`). Names and assertions:
  - `deal removes lowest cards first and deals floor(52/n)`: for n=5..9 hands all have length floor(52/n); `removed` equals the table in `rules.md` (5: 2D 2C; 6: all 2s; 7: 2D 2C 2H; 8: all 2s; 9: all 2s + 3D 3C 3H).
  - `points total 235 for every n`: sum of `points` over all dealt cards plus removed equals 235.
  - `125 ends bidding immediately`: first bidder bids 125, phase is `declare` and bidder/bid are that player/125.
  - `bid must beat last, be a multiple of 5, and meet the minimum`: `placeBid` throws for 65 (n=5), 70 (n=6), 72, and for a repeat of the current bid.
  - `everyone passing makes the last player take the minimum bid`: n=5 → bid 70, n=6 → bid 75, bidder is the only player who did not pass.
  - `bidder holding every named partner card plays alone`: n=5, bidder names a card from their own hand; after play `result.team` is `[bidder]` and `scores[bidder] === bid` if success (use `scoreRound` directly for the success/failure arithmetic).
  - `scoreRound: equal to bid counts as made`; `miss: only bidder gets -bid, partner 0, opponents 0`; `made: bidder and each partner +bid, opponents 0`.
  - `trickWinner: highest trump wins; with no trump highest of led suit wins; off-suit ace loses`.
  - `legalCards: must follow suit; any card when void`.
  - `lastTrick holds cards, winner and points after a trick completes`, and `viewFor(p).you === p`.
  - `1000 random full games`: random n in 5..9, random legal bids/passes, random declare (valid distinct in-play partner cards), random legal play; every game ends in phase `done`, `captured` sums to 235, and `result.scores` obeys the scoring rule.
- [ ] **Step 3: Run `node test.js`**; expected: new tests FAIL (helpers/`you`/`lastTrick` missing).
- [ ] **Step 4: Implement** the IIFE/export pattern, the three pure helpers, `lastTrick`, and `you` in `viewFor`, delegating from `Game` as described.
- [ ] **Step 5: Run `node test.js`**; expected: all PASS.
- [ ] **Step 6: Commit** (`git add -A` including the existing `docs/`, `rules.md`, `CLAUDE.md`).

---

### Task 2: Simple bot

**Files:**
- Create: `bot.js`, `tests/bot.test.js`

**Interfaces:**
- Consumes: Task 1 `legalCards`, `trickWinner`, `points`, `strength`, `suitOf`, `fullDeck`, `partnerCount`, `minBid`, `MAX_BID`, `BID_STEP`; a view from `Game.viewFor(seat)`.
- Produces:
  - `botBid(view): { action:'bid', amount:number } | { action:'pass' }`: amount is valid for `Game.placeBid` (>= current floor, <= 125, multiple of 5).
  - `botDeclare(view): { trump:string, partnerCards:string[] }`: trump = suit with most cards in own hand (more points breaks ties); partner cards = highest-strength in-play cards (not in `view.removed`) the bot does not hold, count `partnerCount(n)`, distinct.
  - `botPlay(view): string`: a legal card; if some legal card makes `trickWinner(trick + card, trump) === view.you`, the lowest such card; otherwise the lowest legal card (lowest = non-trump before trump, then lowest strength). Leading plays the lowest legal card.

- [ ] **Step 1: Write failing tests:**
  - `botBid returns a bid Game.placeBid accepts, or pass`: over 500 random deals and all seats/phases of bidding.
  - `weak hand passes, strong hand bids`: a hand with 0 points passes; a hand holding QS plus A/K/Q/J in three suits bids.
  - `all-pass is rare`: simulating 1000 six-player bidding rounds with bots only, fewer than 10% end with nobody bidding.
  - `botDeclare names playable distinct partner cards`: count `partnerCount(n)`, none in own hand, none in `removed`; `trump` is the bot's longest suit.
  - `botPlay takes the trick with the lowest winning card`: view `{n:6, you:2, trump:'S', trick:[{player:1,card:'9H'}], yourHand:['KH','10H','2C']}` returns `'10H'`.
  - `botPlay plays lowest legal when it cannot win`: trick `[{player:1,card:'AH'}]`, hand `['KH','7H']`, trump `'S'` returns `'7H'`.
  - `six-player games played only by bots finish`: 200 full games using the three functions end in phase `done`.
- [ ] **Step 2: Run `node test.js`**; expected: bot tests FAIL (module missing).
- [ ] **Step 3: Implement** `bot.js`. Bid rule: estimate from hand points and trump length; the builder tunes thresholds until the all-pass test passes. Never bid above 125.
- [ ] **Step 4: Run `node test.js`**; expected: all PASS.
- [ ] **Step 5: Commit.**

---

### Task 3: Scoreboard and storage

**Files:**
- Create: `scoreboard.js`, `tests/scoreboard.test.js`

**Interfaces:**
- Produces:
  - `botNames(n): string[]`: `['You', 'Asha', ...]` length n.
  - `newScoreboard(n): { names:string[], totals:number[], rounds:number }`
  - `applyRound(sb, scores:number[]): Scoreboard`: returns a new object; totals added per seat, `rounds + 1`; input not mutated.
  - `saveScoreboard(storage, sb): boolean`; `loadScoreboard(storage): Scoreboard | null`; `clearScoreboard(storage): void`. Key `blackqueen.scoreboard.v1`. `storage` is anything with `getItem/setItem/removeItem`; every call is wrapped in try/catch.

- [ ] **Step 1: Write failing tests:**
  - `applyRound adds per seat and does not mutate`.
  - `save then load round-trips`.
  - `load returns null for: no key, invalid JSON, wrong shape (totals length != names length, non-number total), storage whose getItem throws`.
  - `save returns false instead of throwing when setItem throws`.
  - `botNames(9) has 9 fixed names with 'You' first; botNames(5) is a prefix of botNames(9)`.
- [ ] **Step 2: Run `node test.js`**; expected: FAIL.
- [ ] **Step 3: Implement** `scoreboard.js`; validate shape on load.
- [ ] **Step 4: Run `node test.js`**; expected: all PASS.
- [ ] **Step 5: Commit.**

---

### Task 4: Session driver

**Files:**
- Create: `session.js`, `tests/session.test.js`

**Interfaces:**
- Consumes: Task 1 `Game`, Task 2 bot functions.
- Produces: `class Session`
  - `constructor({ n, rng = Math.random, schedule = (fn, ms) => setTimeout(fn, ms), onChange = () => {}, bots = <bot.js>, botDelay = 700, trickPause = 1500 })`
  - `Session.USER = 0`; `start(): void`
  - `state(): { view, userTurn:boolean, paused:boolean, completedTrick:null|{cards,winner,points}, bids:(number|'pass'|null)[] }` where `view = game.viewFor(0)`
  - `userBid(amount)`, `userPass()`, `userDeclare(trump, partnerCards)`, `userPlay(card)`: act for seat 0, then continue bots via `schedule`; each calls `onChange(state())` after every change.
  - Errors: calling any user action when it is not seat 0's turn throws `Error('Not your turn')`; during the post-trick pause throws `Error('Wait for the trick to finish')`; game state unchanged in both cases.
  - After a trick completes, `completedTrick` is set and `paused` true for `trickPause` ms, then cleared and play continues. Bots act one at a time, `botDelay` apart.

- [ ] **Step 1: Write failing tests** with a fake `schedule` that queues callbacks and a helper to run them in order:
  - `bots act after botDelay and stop at the user's turn`.
  - `user actions throw Not your turn while a bot is thinking, and the view is unchanged`.
  - `completed trick is held with winner and points, userPlay throws Wait for the trick to finish, then it clears after trickPause`.
  - `full game with the user playing the first legal card ends in phase done with captured summing to 235` (for n=5 and n=9).
  - `when everyone passes and the user is last, the user becomes bidder at the minimum bid`: `bots` stub that always passes, `rng: () => 0.2` with n=6 (first bidder seat 1, user last); expect phase `declare`, bidder 0, bid 75.
  - `bids array records each seat's latest bid or pass`.
- [ ] **Step 2: Run `node test.js`**; expected: FAIL.
- [ ] **Step 3: Implement** `session.js`. Bots receive only `game.viewFor(seat)`. Use `game.lastTrick` to detect a completed trick.
- [ ] **Step 4: Run `node test.js`**; expected: all PASS.
- [ ] **Step 5: Commit.**

---

### Task 5: Renderers

**Files:**
- Create: `render.js`, `tests/render.test.js`

**Interfaces:**
- Consumes: `Session.state()` shape (Task 4), `Scoreboard` (Task 3), `legalCards`, `minBid`, `partnerCount` (Task 1).
- Produces:
  - `renderHand(hand:string[], { legal:string[], selected:string|null, partnerCards:string[], enabled:boolean }): string`: rows of at most 5 `.hand-row`; a tappable card is `<button class="card" data-action="select" data-card="KH">`; the selected card gets class `selected` and `data-action="play"`; non-legal or `!enabled` cards are `aria-disabled="true"` with no `data-action`; a card in `partnerCards` gets class `partner-card`.
  - `renderScreen(ctx): string` with `ctx = { screen:'setup'|'game'|'result', names:string[], state:SessionState|null, selected:string|null, bidAmount:number, trump:string|null, partnerPicks:string[], setup:{ n:number, savedMismatch:boolean }, scoreboard:Scoreboard }`.
  - Action names (`data-action`) used by `app.js`: `set-players` (`data-n`), `start`, `confirm-reset`, `cancel-reset`, `reset-scoreboard`, `bid-step` (`data-delta` ±5), `bid`, `pass`, `pick-trump` (`data-suit`), `pick-partner` (`data-card`), `declare`, `select`, `play`, `next-round`, `stop`.

- [ ] **Step 1: Write failing tests:**
  - `10-card hand renders two rows of 5; 5-card hand renders one row`.
  - `cards that are illegal, or any card when enabled is false, are aria-disabled and have no data-action`.
  - `selected card has class selected and data-action play; others have data-action select`.
  - `a named partner card in the user's hand has class partner-card`.
  - `partner holder is not named until revealed`: with `partnerCards:['KH']`, `revealedPartners:[]` the play screen does not contain the holder's name; with `revealedPartners:[3]` it contains `names[3]` marked as partner.
  - `bidding screen shows each seat's bid or pass; bid controls only when userTurn`; the default shown amount is `highBid + 5` (or `minBid(n)` when no bid), and bid controls are absent when `highBid` makes the next bid exceed 125.
  - `declare screen offers exactly partnerCount(n) partner picks and only in-play cards`.
  - `result screen shows made/missed, bid, team points, team names and each seat's round change and running total`.
  - `setup with savedMismatch shows confirm-reset and cancel-reset`.
- [ ] **Step 2: Run `node test.js`**; expected: FAIL.
- [ ] **Step 3: Implement** `render.js`; escape any interpolated text.
- [ ] **Step 4: Run `node test.js`**; expected: all PASS.
- [ ] **Step 5: Commit.**

---

### Task 6: App, layout and styling

**Files:**
- Create: `index.html`, `styles.css`, `app.js`

**Interfaces:**
- Consumes: Tasks 1 to 5 via `BQ`. `index.html` loads scripts in order: `blackqueen.js`, `bot.js`, `scoreboard.js`, `session.js`, `render.js`, `app.js`, plus the manifest link and viewport meta `width=device-width, initial-scale=1`.
- Produces: the working game in a browser.

- [ ] **Step 1: Implement `app.js`:** one root element; a single event listener on it dispatching by `data-action`; screen state per `renderScreen`'s `ctx`; load the scoreboard with `loadScoreboard(localStorage)`; on `start` with a saved scoreboard whose `names.length !== n`, show the reset prompt (`confirm-reset` creates a new scoreboard, `cancel-reset` returns to setup); create a `Session` with `onChange` re-rendering; when the state reaches phase `done`, call `applyRound` and `saveScoreboard` exactly once per session (guard flag); `next-round` starts a new `Session` with the same `n`; `stop` returns to setup keeping the scoreboard; `reset-scoreboard` clears it.
- [ ] **Step 2: Implement `styles.css`**, mobile first: CSS variables `--card-w: 60px; --card-h: 88px` on phones; the felt table, seats, trick area and hand from the mockup; tap targets at least 44 px; no horizontal page scroll at 360 px wide; at `min-width: 900px` larger cards in one row and a wider table layout. Respect light/dark with `prefers-color-scheme`.
- [ ] **Step 3: Verify in a browser.** Run `python3 -m http.server 8000` in the project folder, open `http://localhost:8000`, set a 360 x 640 viewport, and check each item, fixing anything that fails:
  - 5-player hand shows 2 rows of 5 and every card measures at least 60 x 88 px (read via the browser console: `[...document.querySelectorAll('.card')].every(c => c.offsetWidth >= 60 && c.offsetHeight >= 88)` is `true`).
  - A full round can be played; tapping a card once lifts it, tapping again plays it; dimmed cards cannot be selected; tapping during a bot's turn does nothing.
  - Result screen scores match the rules; reload after the result keeps totals and does not double-count; switching the player count shows the reset prompt.
  - At 1200 px wide the layout uses the desktop arrangement and still works.
- [ ] **Step 4: Commit.**

---

### Task 7: PWA

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `icons/icon-192.png`, `icons/icon-512.png`, `tools/make-icons.js`, `tests/pwa.test.js`
- Modify: `index.html` (register `./sw.js`, link manifest, `theme-color`)

**Interfaces:**
- `sw.js`: `const CACHE = 'blackqueen-v1'` and `const FILES = [...]` listing `./`, `./index.html`, `./styles.css`, every script, the manifest and both icons; install precaches `FILES`, fetch is cache-first with network fallback, activate deletes other caches.
- `tools/make-icons.js`: writes the two PNGs using only Node's `zlib` (solid felt-green square with a simple gold shape); no dependencies.

- [ ] **Step 1: Write failing tests in `tests/pwa.test.js`:**
  - `manifest has name, start_url "./", display "standalone", and 192 and 512 png icons that exist`.
  - `PNG icons have the correct dimensions` (read width/height from the IHDR chunk).
  - `every file in sw.js FILES exists, and every <script src> and stylesheet in index.html is in FILES`.
- [ ] **Step 2: Run `node test.js`**; expected: FAIL.
- [ ] **Step 3: Implement** the manifest, `tools/make-icons.js` (run it), `sw.js`, and the `index.html` registration.
- [ ] **Step 4: Run `node test.js`**; expected: all PASS.
- [ ] **Step 5: Verify in a browser** at `http://localhost:8000`: DevTools shows the service worker active and the manifest valid; after loading once, stopping the server and reloading still shows the app.
- [ ] **Step 6: Commit.**

---

### Task 8: Docs and deploy

**Files:**
- Modify: `rules.md`, `CLAUDE.md`

- [ ] **Step 1:** In `rules.md` remove the "(ASSUMED, please confirm)" and "(PLACEHOLDER, please confirm)" labels and write the confirmed scoring and play rules (see Global Constraints). In `CLAUDE.md` update the Files list (all new files, `node test.js` runs `tests/`), and record the Plan status.
- [ ] **Step 2: Run `node test.js`**; expected: all PASS.
- [ ] **Step 3: Commit.**
- [ ] **Step 4: Ask the user to confirm the push** to `https://github.com/ravindragaikwad/black-queen`. Do not continue without a yes. Check `gh auth status` first; if the logged-in account cannot write to that repo, stop and ask.
- [ ] **Step 5:** After the yes: `git remote add origin https://github.com/ravindragaikwad/black-queen.git`, `git push -u origin main`, then enable Pages from branch `main`, path `/` (`gh api -X POST repos/ravindragaikwad/black-queen/pages -f "source[branch]=main" -f "source[path]=/"`).
- [ ] **Step 6: Verify** `https://ravindragaikwad.github.io/black-queen/` loads on a phone, a round plays, and Add to Home Screen works. Report the URL to the user.
