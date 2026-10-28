'use strict';
// Plays smart bots against easy bots at the same table and prints who scores more.
// Usage: node tools/tournament.js [games per table size, default 3000]
const bq = require('../blackqueen');
const easy = require('../bot');
const { smartBots } = require('../smart');

function seeded(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function playGame(n, botFor, rng) {
  const g = new bq.Game(n, { rng });
  while (g.phase === 'bidding') {
    const seat = g.turn;
    const r = botFor(seat).botBid(g.viewFor(seat));
    if (r.action === 'bid') g.placeBid(seat, r.amount);
    else g.pass(seat);
  }
  const d = botFor(g.bidder).botDeclare(g.viewFor(g.bidder));
  g.declare(g.bidder, d.trump, d.partnerCards);
  while (g.phase === 'play') {
    const seat = g.turn;
    g.play(seat, botFor(seat).botPlay(g.viewFor(seat)));
  }
  return g;
}

const games = Number(process.argv[2]) || 3000;
console.log(`Smart vs easy bots, ${games} games per table size (average score per seat per round)`);
for (const n of [5, 6, 7, 8, 9]) {
  const rng = seeded(100 + n);
  let smart = 0, simple = 0, smartSeats = 0, simpleSeats = 0;
  for (let i = 0; i < games; i++) {
    const smartOnEven = i % 2 === 0; // swap which seats are smart so seat position cannot decide it
    const isSmart = (seat) => (seat % 2 === 0) === smartOnEven;
    const g = playGame(n, (seat) => (isSmart(seat) ? smartBots : easy), rng);
    g.result.scores.forEach((s, seat) => {
      if (isSmart(seat)) { smart += s; smartSeats++; } else { simple += s; simpleSeats++; }
    });
  }
  console.log(`${n} players: smart ${(smart / smartSeats).toFixed(1)}  easy ${(simple / simpleSeats).toFixed(1)}`);
}
