# Black Queen: Project Notes

A web-first card game (Black Queen) for 5+ players, built as a PWA, with a possible store wrap later via Capacitor. Other apps (more card games, a PDF reader) may follow.

## Files
- `rules.md`: the agreed rules spec. Read this first.
- `blackqueen.js`: pure JS game logic (no dependencies, works in Node and browsers). Main class: `Game`.
- `test.js`: tests. Run with `node test.js`. Includes 1,000 random full-game simulations.

## Decisions made (by the user)
- Minimum 5 players, no fixed maximum. Cards per player = floor(52 / players); leftover cards are removed, lowest first (2s, then 3s, then 4s). Removal order: 2D 2C 2H 2S 3D 3C 3H 3S 4D 4C 4H 4S.
- Points: A, K, Q, J, 10 = 10 each; 5 = 5; Queen of Spades = 25. Total is 235 and never changes when cards are removed.
- Max bid 125, step 5. Min bid 70 with 5 players, 75 with 6 or more.
- First bidder is random, then clockwise. Each bid must beat the last, and passing is final.
- Bid winner picks trump and names specific partner cards (they may name a card they hold themselves).
- Partner count = floor((players - 3) / 2): 5 -> 1, 6 -> 1, 7 -> 2, 8 -> 2, 9 -> 3.

- Play (confirmed): bidder leads; must follow suit; highest trump wins, else highest card of the led suit; trick winner leads next.
- Scoring (confirmed): bid made (team points >= bid, equal counts as made) gives the bidder and every partner +bid, opponents 0. Bid missed gives the bidder -bid, partners and opponents 0.
- No end condition: running totals, play until the group stops.

- If everyone passes, the last player is forced to take the minimum bid (confirmed).

- A bid of 125 ends bidding immediately (confirmed).

- UI (confirmed): mobile-first design that works the same way on desktop. First version is single-player: user in seat 1, bots in the other seats.
- Stack (my call, not yet confirmed): plain HTML/CSS/JS, no framework, reusing `blackqueen.js`, PWA. Start with one simple bot level; smarter bot and pass-and-play later.
- Hosting (confirmed): GitHub Pages, repo https://github.com/ravindragaikwad/black-queen. Design doc: docs/superpowers/specs/2026-10-28-single-player-ui-design.md (awaiting user approval).
- Node is installed via Homebrew at /opt/homebrew/bin/node (not on this shell's PATH).

## Assumptions NOT yet confirmed
- Partners losing nothing on a missed bid, and "equal to the bid counts as made", are readings of the user's words; confirm if it ever matters.

## Open questions
None on scoring or play.

## Plan
1. Pass-and-play web UI with bots, to test alone.
2. Online rooms: realtime backend (Firebase, Supabase Realtime, PartyKit or Cloudflare Durable Objects), room codes, server-side dealing and validation. Use `Game.viewFor(player)` so each player only receives their own hand.
3. Capacitor wrap for the app stores only if it gets traction.
