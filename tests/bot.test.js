'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const bq = require('../blackqueen');
const bot = require('../bot');
const { seeded } = require('./helpers');

const { Game, points, partnerCount } = bq;

// Bots decide every bid in a round; returns the finished-bidding game.
function botBidding(n, rng) {
  const g = new Game(n, { rng });
  while (g.phase === 'bidding') {
    const seat = g.turn;
    const r = bot.botBid(g.viewFor(seat));
    if (r.action === 'bid') g.placeBid(seat, r.amount);
    else g.pass(seat);
  }
  return g;
}

test('botBid returns a bid Game.placeBid accepts, or pass', () => {
  const rng = seeded(11);
  for (let i = 0; i < 500; i++) {
    const n = 5 + Math.floor(rng() * 5);
    botBidding(n, rng); // placeBid throws on an invalid amount
  }
});

test('weak hand passes, strong hand bids', () => {
  const base = { n: 6, you: 0, phase: 'bidding', highBid: null, highBidder: null };
  const weak = ['3H', '6D', '7C', '8S', '9H', '6S', '7D', '8C'];
  const strong = ['QS', 'AH', 'KH', 'AD', 'KD', 'AC', 'KC', 'JH'];
  assert.equal(bot.botBid({ ...base, yourHand: weak }).action, 'pass');
  assert.equal(bot.botBid({ ...base, yourHand: strong }).action, 'bid');
});

test('all-pass is rare with bots at the table', () => {
  const rng = seeded(12);
  let nobodyBid = 0;
  for (let i = 0; i < 1000; i++) {
    if (botBidding(6, rng).highBid === null) nobodyBid++;
  }
  assert.ok(nobodyBid < 100, `all-pass happened ${nobodyBid}/1000 times`);
});

test('botDeclare names playable distinct partner cards and its longest suit as trump', () => {
  const rng = seeded(13);
  for (let i = 0; i < 200; i++) {
    const n = 5 + Math.floor(rng() * 5);
    const g = botBidding(n, rng);
    const view = g.viewFor(g.bidder);
    const { trump, partnerCards } = bot.botDeclare(view);
    assert.equal(partnerCards.length, partnerCount(n));
    assert.equal(new Set(partnerCards).size, partnerCards.length);
    for (const c of partnerCards) {
      assert.ok(!view.yourHand.includes(c), 'not in own hand');
      assert.ok(!view.removed.includes(c), 'not removed');
    }
    const count = (s) => view.yourHand.filter((c) => bq.suitOf(c) === s).length;
    assert.equal(count(trump), Math.max(...bq.SUITS.map(count)));
    g.declare(g.bidder, trump, partnerCards); // Game accepts it
  }
});

test('botPlay takes the trick with the lowest winning card', () => {
  const view = {
    n: 6, you: 2, trump: 'S', trick: [{ player: 1, card: '9H' }], yourHand: ['KH', '10H', '2C'],
  };
  assert.equal(bot.botPlay(view), '10H');
});

test('botPlay plays lowest legal when it cannot win', () => {
  const view = {
    n: 6, you: 2, trump: 'S', trick: [{ player: 1, card: 'AH' }], yourHand: ['KH', '7H'],
  };
  assert.equal(bot.botPlay(view), '7H');
});

test('games played only by bots finish', () => {
  const rng = seeded(14);
  for (let i = 0; i < 200; i++) {
    const g = botBidding(6, rng);
    const d = bot.botDeclare(g.viewFor(g.bidder));
    g.declare(g.bidder, d.trump, d.partnerCards);
    while (g.phase === 'play') {
      const seat = g.turn;
      g.play(seat, bot.botPlay(g.viewFor(seat))); // throws on an illegal card
    }
    assert.equal(g.phase, 'done');
    assert.equal(g.captured.reduce((a, b) => a + b, 0), 235);
    assert.ok(points('QS') === 25);
  }
});
