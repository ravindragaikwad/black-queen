'use strict';
// Shared test helpers (not a test file itself).
const bq = require('../blackqueen');

// Small seeded RNG so failures are reproducible.
function seeded(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

// Random legal bidding until the bid is decided.
function randomBidding(g, rng) {
  while (g.phase === 'bidding') {
    const floor = g.highBid === null ? bq.minBid(g.n) : g.highBid + bq.BID_STEP;
    if (rng() < 0.4) {
      const amount = Math.min(bq.MAX_BID, floor + bq.BID_STEP * Math.floor(rng() * 3));
      g.placeBid(g.turn, amount);
    } else {
      g.pass(g.turn);
    }
  }
}

// Random valid trump and distinct in-play partner cards.
function randomDeclare(g, rng) {
  const inPlay = g.initialHands.flat();
  const cards = [];
  while (cards.length < bq.partnerCount(g.n)) {
    const c = pick(inPlay, rng);
    if (!cards.includes(c)) cards.push(c);
  }
  g.declare(g.bidder, pick(bq.SUITS, rng), cards);
}

function randomPlay(g, rng) {
  while (g.phase === 'play') {
    g.play(g.turn, pick(g.legalCards(g.turn), rng));
  }
}

function randomGame(n, rng) {
  const g = new bq.Game(n, { rng });
  randomBidding(g, rng);
  randomDeclare(g, rng);
  randomPlay(g, rng);
  return g;
}

module.exports = { seeded, pick, randomBidding, randomDeclare, randomPlay, randomGame };
