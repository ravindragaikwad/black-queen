'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const bq = require('../blackqueen');
const easy = require('../bot');
const { smartBots } = require('../smart');
const { seeded } = require('./helpers');

const { Game } = bq;

// A full game where each seat is played by the given bot set. Returns the finished Game.
function playGame(n, botFor, rng) {
  const g = new Game(n, { rng });
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

const baseView = (over) => ({
  n: 5, you: 4, phase: 'play', trump: 'S', partnerCards: ['KD'], revealedPartners: [], bidder: 0, bid: 85,
  trick: [], yourHand: [], handSizes: [5, 5, 5, 5, 5], won: [[], [], [], [], []], captured: [0, 0, 0, 0, 0],
  history: [], removed: ['2D', '2C'], ...over,
});

test('smart bots always make legal moves, at every table size, alone and mixed with simple bots', () => {
  const rng = seeded(61);
  for (let i = 0; i < 300; i++) {
    const n = 5 + (i % 5);
    const mixed = i % 2 === 0;
    const g = playGame(n, (seat) => (mixed && seat % 2 ? easy : smartBots), rng);
    assert.equal(g.phase, 'done');
    assert.equal(g.captured.reduce((a, b) => a + b, 0), 235);
  }
});

test('feeds point cards to a teammate who is winning the trick', () => {
  const view = baseView({
    you: 4, bidder: 4, revealedPartners: [2], bid: 85,
    trick: [{ player: 0, card: '3H' }, { player: 1, card: '4H' }, { player: 2, card: 'AH' }, { player: 3, card: '5H' }],
    yourHand: ['10C', '4C', '7D'],
  });
  assert.equal(smartBots.botPlay(view), '10C');
});

test('does not feed point cards to the bidding team', () => {
  const view = baseView({
    you: 4, bidder: 1,
    trick: [{ player: 0, card: '3H' }, { player: 1, card: 'AH' }, { player: 2, card: '4H' }, { player: 3, card: '5H' }],
    yourHand: ['10C', '4C', '7D'],
  });
  assert.equal(smartBots.botPlay(view), '4C');
});

test('an opponent wins a points trick off the bidder with the cheapest winning card', () => {
  const view = baseView({
    you: 4, bidder: 0,
    trick: [{ player: 0, card: '10H' }, { player: 1, card: '3H' }, { player: 2, card: '4H' }, { player: 3, card: '6H' }],
    yourHand: ['AH', 'KH', 'QH', '5C'],
  });
  assert.equal(smartBots.botPlay(view), 'QH');
});

test('does not ruff a trick its own teammate is already winning', () => {
  const view = baseView({
    you: 4, bidder: 4, revealedPartners: [2],
    trick: [{ player: 0, card: '3H' }, { player: 1, card: '4H' }, { player: 2, card: 'AH' }, { player: 3, card: '5H' }],
    yourHand: ['2S', '6C'],
  });
  assert.equal(smartBots.botPlay(view), '6C');
});

test('trumps a trick full of points that an opponent is winning', () => {
  const view = baseView({
    you: 4, bidder: 4,
    trick: [{ player: 0, card: 'AH' }, { player: 1, card: '10H' }, { player: 2, card: 'KH' }, { player: 3, card: '3H' }],
    yourHand: ['2S', '6C'],
  });
  assert.equal(smartBots.botPlay(view), '2S');
});

test('holding the queen of spades, an opponent keeps it away from a trick the bidding team is winning', () => {
  const view = baseView({
    you: 4, bidder: 1, trump: 'H',
    trick: [{ player: 0, card: '3C' }, { player: 1, card: 'AC' }, { player: 2, card: '4C' }, { player: 3, card: '5C' }],
    yourHand: ['QS', '7S', '9D'],
  });
  assert.notEqual(smartBots.botPlay(view), 'QS');
});

test('declares its longest strong suit as trump and asks for the trump ace it lacks', () => {
  const view = baseView({
    n: 6, you: 0, phase: 'declare', bidder: 0, trump: null, partnerCards: [], removed: ['2D', '2C', '2H', '2S'],
    yourHand: ['KS', 'QS', 'JS', '9S', '8S', '4H', '5D', '6C'], handSizes: [8, 8, 8, 8, 8, 8],
  });
  const d = smartBots.botDeclare(view);
  assert.equal(d.trump, 'S');
  assert.deepEqual(d.partnerCards, ['AS']);
});

test('names the right number of distinct, in-play cards it does not hold', () => {
  const rng = seeded(62);
  for (let i = 0; i < 200; i++) {
    const n = 5 + (i % 5);
    const g = new Game(n, { rng });
    while (g.phase === 'bidding') { const s = g.turn; const r = smartBots.botBid(g.viewFor(s)); if (r.action === 'bid') g.placeBid(s, r.amount); else g.pass(s); }
    const v = g.viewFor(g.bidder);
    const d = smartBots.botDeclare(v);
    assert.equal(d.partnerCards.length, bq.partnerCount(n));
    assert.equal(new Set(d.partnerCards).size, d.partnerCards.length);
    for (const c of d.partnerCards) assert.ok(!v.yourHand.includes(c) && !v.removed.includes(c));
    g.declare(g.bidder, d.trump, d.partnerCards);
  }
});

test('bids more on a strong hand than a weak one, and never bids an invalid amount', () => {
  const base = { n: 6, you: 0, phase: 'bidding', highBid: null, highBidder: null };
  const weak = ['3H', '6D', '7C', '8S', '9H', '6S', '7D', '8C'];
  const strong = ['QS', 'AS', 'KS', 'JS', '10S', 'AH', 'KH', 'AD'];
  const w = smartBots.botBid({ ...base, yourHand: weak });
  const s = smartBots.botBid({ ...base, yourHand: strong });
  assert.equal(s.action, 'bid');
  assert.ok(s.amount >= 75 && s.amount <= 125 && s.amount % 5 === 0);
  assert.ok(w.action === 'pass' || s.amount >= w.amount + 10, 'the strong hand bids clearly higher');
  // it never bids against a bid it cannot profitably beat, and never goes past the maximum
  assert.equal(smartBots.botBid({ ...base, yourHand: strong, highBid: 125 }).action, 'pass');
  const rng = seeded(63);
  for (let i = 0; i < 300; i++) {
    const g = new Game(5 + (i % 5), { rng });
    while (g.phase === 'bidding') { const seat = g.turn; const r = smartBots.botBid(g.viewFor(seat)); if (r.action === 'bid') g.placeBid(seat, r.amount); else g.pass(seat); }
  }
});

test('everyone-passes stays rare with smart bots at the table', () => {
  const rng = seeded(64);
  let nobody = 0;
  for (let i = 0; i < 500; i++) {
    const g = new Game(6, { rng });
    while (g.phase === 'bidding') { const s = g.turn; const r = smartBots.botBid(g.viewFor(s)); if (r.action === 'bid') g.placeBid(s, r.amount); else g.pass(s); }
    if (g.highBid === null) nobody++;
  }
  assert.ok(nobody < 60, `all-pass happened ${nobody}/500 times`);
});

// The real test: at the same table, smart seats must out-score the simple bots.
function tournament(n, games, seed) {
  const rng = seeded(seed);
  let smart = 0, simple = 0, smartSeats = 0, simpleSeats = 0;
  for (let i = 0; i < games; i++) {
    const smartOnEven = i % 2 === 0; // swap which seats are smart so position cannot decide it
    const isSmart = (seat) => (seat % 2 === 0) === smartOnEven;
    const g = playGame(n, (seat) => (isSmart(seat) ? smartBots : easy), rng);
    g.result.scores.forEach((s, seat) => {
      if (isSmart(seat)) { smart += s; smartSeats++; } else { simple += s; simpleSeats++; }
    });
  }
  return { smart: smart / smartSeats, simple: simple / simpleSeats };
}

test('smart bots out-score simple bots at the same table (6 players)', () => {
  const r = tournament(6, 1000, 71);
  assert.ok(r.smart > r.simple + 8, `smart ${r.smart.toFixed(2)} vs simple ${r.simple.toFixed(2)} per seat per round`);
});

test('smart bots out-score simple bots at 5 and 8 players too', () => {
  for (const n of [5, 8]) {
    const r = tournament(n, 600, 72 + n);
    assert.ok(r.smart > r.simple + 4, `n=${n}: smart ${r.smart.toFixed(2)} vs simple ${r.simple.toFixed(2)}`);
  }
});
