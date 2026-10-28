'use strict';
// Plays the three bot levels against each other at the same table and prints who scores more.
// Seats rotate between easy, medium and smart every game, so seat position cannot decide it.
// Usage: node tools/tournament.js [games per table size, default 3000]
const bq = require('../blackqueen');
const easy = require('../bot');
const { mediumBots, smartBots } = require('../smart');

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
const levels = [['easy', easy], ['medium', mediumBots], ['smart', smartBots]];
console.log(`Easy vs medium vs smart bots, ${games} games per table size (average score per seat per round)`);
for (const n of [5, 6, 7, 8, 9]) {
  const rng = seeded(100 + n);
  const sum = [0, 0, 0];
  const seats = [0, 0, 0];
  for (let i = 0; i < games; i++) {
    const level = (seat) => (seat + i) % 3;
    const g = playGame(n, (seat) => levels[level(seat)][1], rng);
    g.result.scores.forEach((s, seat) => { sum[level(seat)] += s; seats[level(seat)]++; });
  }
  console.log(`${n} players: ` + levels.map(([name], k) => `${name} ${(sum[k] / seats[k]).toFixed(1)}`).join('  '));
}
