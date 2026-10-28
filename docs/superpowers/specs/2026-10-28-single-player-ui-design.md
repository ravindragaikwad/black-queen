# Black Queen: single-player web app (design)

Date: 2026-10-28

## Intent and why

Black Queen is a trick-taking card game the user plays with a group of 5 or more. They want a web app they can open on a phone (and on a desktop) and play a full game of it. The first version is for the user alone: they sit in seat 1 and every other seat is a bot. This lets them test the game and play it any time without needing a full table. Online rooms and pass-and-play with other humans are planned for later and are out of scope here.

## Goals

- A complete round playable start to finish: setup, deal, bid, choose trump and partner card(s), play all tricks, score, then deal the next round.
- Mobile first. It must be comfortable on a phone held in one hand, and work the same way on a desktop browser (same flow, larger layout).
- Cards big enough to tap easily. This is the user's top concern.
- Installable as a PWA (works offline once loaded).
- The running scoreboard is saved on the device and survives closing the app.

## Non-goals

- Online multiplayer, accounts, room codes, a backend.
- Pass-and-play with several humans on one device (later).
- App store packaging (a possible later Capacitor wrap).
- A smart bot (later). Sound, animations beyond simple transitions, and themes are not required.

## Anti-goals (a failure even if it technically works)

- Cards too small or too close together to tap reliably on a phone.
- Playing the wrong card by accident from a stray tap.
- Showing the user any other player's hand, or revealing partners before their partner card is played.

## Rules (all confirmed by the user)

The full spec is in `rules.md`, and `CLAUDE.md` lists the decisions. The game logic already exists in `blackqueen.js` (class `Game`) and must be reused, not rewritten. Summary:

- 5 to 9 players offered in the UI. Cards per player = floor(52 / players); leftover cards are removed lowest first.
- Points: A, K, Q, J, 10 = 10; 5 = 5; Queen of Spades = 25; total 235.
- Bids from the minimum (70 with 5 players, 75 with 6+) up to 125 in steps of 5. First bidder random, then clockwise. Passing is final. 125 ends bidding. If everyone passes, the last player takes the minimum bid.
- Bid winner picks trump and names floor((players - 3) / 2) specific partner card(s), which may include a card they hold.
- Play: bidder leads; must follow suit; highest trump wins, otherwise highest card of the led suit; trick winner leads next.
- Scoring: team points >= bid is a success (equal counts as made). On success the bidder and each partner get +bid and opponents get 0. On failure the bidder gets -bid and everyone else gets 0. The user said "losing bidder loses it" and "opponents get nothing"; partners losing nothing on a miss is the design's reading of that.
- There is no end condition. Running totals continue until the user stops.

## Screens and flow

A visual mockup was agreed on (looks good): `blackqueen-mockup.html`, copied next to this file under `docs/superpowers/specs/mockup/`. Flow: setup, deal, bid, call, play, score, then back to deal for the next round.

1. **Setup.** Choose 5 to 9 players. Seat 1 is the user; the rest are bots with names.
2. **Bidding.** Shows each seat's bid or pass, the user's hand, and Bid / raise / Pass controls when it is the user's turn. Bots act automatically with a short pause so the user can follow.
3. **Trump and partner.** If the user won the bid they choose trump and name their partner card(s). If a bot won, show who won and at what bid, and that the bot has named trump and partner card(s) (partners remain hidden until played).
4. **Playing tricks.** Table view with the current trick, per-seat captured points, and the user's hand.
5. **Round result and scoreboard.** Shows whether the bid was made, the team, and each player's change and running total, with "Deal next round" and "Stop".

## Hand interaction (agreed by the user)

- Phone: cards in two rows (up to 5 per row; the most a hand can be is 10 cards with 5 players), each roughly 60 x 88 px, comfortably above the common 44 px minimum tap target. Do not overlap cards into a single small row.
- Tap once to lift a card; tap again (or a Play button) to play it. This prevents accidental plays.
- Cards that cannot be legally played (do not follow suit) are dimmed and cannot be selected.
- Desktop: same cards, larger, in a single row. A click may play the card directly. (Builder may decide whether to keep tap-twice on desktop; the user only specified tap-twice for the phone.)

## Bots (my call, not discussed in detail with the user)

- Version one has a single simple bot level: bid based on points in hand, choose the longest suit as trump, name a high card it does not hold as partner, follow suit, play the lowest card that wins the trick, otherwise play its lowest legal card.
- A smarter level (card counting, guessing partners) is later work. Keep the bot behind a small interface so a second level can be added.

## Persistence

- The scoreboard (names and running totals) is saved on the device (browser local storage) and restored on the next visit. A way to reset the scoreboard is needed.
- Saving a half-finished round is not required. (My call; the user only asked to save the scoreboard.)

## Constraints and how it gets made

- Stack (my call, not yet challenged by the user): plain HTML, CSS and JavaScript, no framework, no backend, reusing `blackqueen.js`. Installable PWA (manifest plus service worker).
- `blackqueen.js` currently exports only through `module.exports`, so it will not load in a browser as-is. The builder should make it work in both Node and browsers without changing its behaviour.
- Node v26.12.1 is installed via Homebrew at `/opt/homebrew/bin/node` (not on the default PATH of Claude's shell). Tests run with `node test.js`.
- `test.js` is referenced in `CLAUDE.md` but does not exist in the folder. It must be created (including a batch of random full-game simulations, as `CLAUDE.md` describes) before the UI relies on the logic.
- `rules.md` still labels play and scoring as "ASSUMED" and "PLACEHOLDER". Update it to the confirmed rules.
- Bots must only use the same information a human in their seat would have (their own hand and public table state). `Game.viewFor(player)` exists for this.

## Hosting (confirmed by the user)

Hosted as a static site on GitHub Pages (HTTPS, so the PWA can install and work offline). Use relative paths and a service-worker scope that works under a repo sub-path. Include 192 and 512 px icons and a manifest. Deploying is part of the plan. The repo is https://github.com/ravindragaikwad/black-queen (given by the user). The project folder sits inside the user's home-directory git repo, so the builder must set up `black-queen` as its own repo (or otherwise publish just this folder) and confirm with the user before pushing anything.

## Calls made after reviewer questions (my calls, not the user's)

- Scoreboard is saved per seat. Changing the player count at setup asks whether to reset it. "Stop" returns to setup and keeps the scoreboard. Bot names are fixed per seat.
- After a trick completes, leave it on the table for about 1.5 seconds, then auto-advance (no extra tap). `Game` may gain a small additive field recording the last trick and its winner; existing behaviour must not change.
- Named partner cards are shown to everyone after the declare step. If the user holds a named card, it is marked privately in their hand. A partner's identity is shown to everyone only once that card is played (`revealedPartners`).
- Bot tuning (bid thresholds, partner-card choice) is the builder's. Bots must bid often enough that "everyone passes" stays rare.
- Desktop single-click versus tap-twice is the builder's.

## Left to the builder

Visual design and colour, file layout, how the service worker caches, bot names, the exact copy on screens, how to structure the UI code, and layout details at in-between screen widths.
