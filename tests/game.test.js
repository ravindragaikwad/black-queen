'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const bq = require('../blackqueen');
const { seeded, randomBidding, randomDeclare, randomPlay, randomGame } = require('./helpers');

const { Game, deal, points, fullDeck, legalCards, trickWinner, scoreRound } = bq;

test('deal removes lowest cards first and deals floor(52/n)', () => {
  const expectedRemoved = {
    5: ['2D', '2C'],
    6: ['2D', '2C', '2H', '2S'],
    7: ['2D', '2C', '2H'],
    8: ['2D', '2C', '2H', '2S'],
    9: ['2D', '2C', '2H', '2S', '3D', '3C', '3H'],
  };
  for (let n = 5; n <= 9; n++) {
    const d = deal(n, seeded(n));
    assert.ok(d.hands.every((h) => h.length === Math.floor(52 / n)), `n=${n} hand sizes`);
    assert.deepEqual(d.removed, expectedRemoved[n], `n=${n} removed`);
  }
});

test('points total 235 for every n', () => {
  for (let n = 5; n <= 9; n++) {
    const d = deal(n, seeded(n));
    const all = [...d.hands.flat(), ...d.removed];
    assert.equal(all.reduce((s, c) => s + points(c), 0), 235);
    assert.equal(all.length, 52);
  }
  assert.equal(fullDeck().reduce((s, c) => s + points(c), 0), 235);
});

test('125 ends bidding immediately', () => {
  const g = new Game(6, { rng: seeded(1) });
  const first = g.turn;
  g.placeBid(first, 125);
  assert.equal(g.phase, 'declare');
  assert.equal(g.bidder, first);
  assert.equal(g.bid, 125);
});

test('bid must beat last, be a multiple of 5, and meet the minimum', () => {
  const g5 = new Game(5, { rng: seeded(2) });
  assert.throws(() => g5.placeBid(g5.turn, 65));
  const g6 = new Game(6, { rng: seeded(2) });
  assert.throws(() => g6.placeBid(g6.turn, 70));
  assert.throws(() => g6.placeBid(g6.turn, 77));
  g6.placeBid(g6.turn, 80);
  assert.throws(() => g6.placeBid(g6.turn, 80));
  assert.throws(() => g6.placeBid(g6.turn, 75));
});

test('everyone passing makes the last player take the minimum bid', () => {
  for (const [n, min] of [[5, 70], [6, 75], [9, 75]]) {
    const g = new Game(n, { rng: seeded(3) });
    const passed = [];
    while (g.phase === 'bidding') {
      passed.push(g.turn);
      g.pass(g.turn);
    }
    assert.equal(g.phase, 'declare');
    assert.equal(g.bid, min, `n=${n} bid`);
    assert.equal(passed.length, n - 1);
    assert.ok(!passed.includes(g.bidder), 'bidder is the one who never passed');
    assert.equal(g.turn, g.bidder);
  }
});

test('bidder holding every named partner card plays alone', () => {
  const rng = seeded(4);
  const g = new Game(5, { rng });
  g.placeBid(g.turn, 125);
  const own = g.initialHands[g.bidder][0];
  g.declare(g.bidder, 'S', [own]);
  randomPlay(g, rng);
  assert.deepEqual(g.result.team, [g.bidder]);
  assert.equal(g.result.scores.filter((s) => s !== 0).length, 1);
  assert.equal(g.result.scores[g.bidder], g.result.success ? 125 : -125);
});

test('scoreRound: made pays bidder and each partner +bid, opponents 0', () => {
  const r = scoreRound({ n: 6, bid: 90, bidder: 0, team: [0, 3], captured: [50, 0, 10, 40, 0, 0] });
  assert.equal(r.teamPoints, 90);
  assert.equal(r.success, true);
  assert.deepEqual(r.scores, [90, 0, 0, 90, 0, 0]);
});

test('scoreRound: exactly equal to the bid counts as made', () => {
  const r = scoreRound({ n: 5, bid: 70, bidder: 1, team: [1], captured: [0, 70, 0, 0, 0] });
  assert.equal(r.success, true);
  assert.equal(r.scores[1], 70);
});

test('scoreRound: a miss costs only the bidder', () => {
  const r = scoreRound({ n: 6, bid: 100, bidder: 2, team: [2, 4], captured: [0, 0, 60, 0, 30, 0] });
  assert.equal(r.success, false);
  assert.deepEqual(r.scores, [0, 0, -100, 0, 0, 0]);
});

test('trickWinner: highest trump wins', () => {
  const trick = [
    { player: 0, card: 'AH' },
    { player: 1, card: '3S' },
    { player: 2, card: '9S' },
    { player: 3, card: 'KH' },
  ];
  assert.equal(trickWinner(trick, 'S'), 2);
});

test('trickWinner: with no trump the highest of the led suit wins', () => {
  const trick = [
    { player: 4, card: '9H' },
    { player: 0, card: 'KH' },
    { player: 1, card: 'QH' },
  ];
  assert.equal(trickWinner(trick, 'S'), 0);
});

test('trickWinner: an off-suit ace loses', () => {
  const trick = [
    { player: 0, card: '5H' },
    { player: 1, card: 'AD' },
    { player: 2, card: '6H' },
  ];
  assert.equal(trickWinner(trick, 'S'), 2);
});

test('legalCards: must follow suit when able', () => {
  const trick = [{ player: 0, card: '5H' }];
  assert.deepEqual(legalCards(['KH', '7H', 'AS'], trick).sort(), ['7H', 'KH']);
});

test('legalCards: any card when void in the led suit or leading', () => {
  assert.deepEqual(legalCards(['AS', 'KD'], [{ player: 0, card: '5H' }]), ['AS', 'KD']);
  assert.deepEqual(legalCards(['AS', 'KD'], []), ['AS', 'KD']);
});

test('lastTrick holds cards, winner and points after a trick completes', () => {
  const rng = seeded(5);
  const g = new Game(5, { rng });
  assert.equal(g.lastTrick, null);
  randomBidding(g, rng);
  randomDeclare(g, rng);
  for (let i = 0; i < g.n; i++) g.play(g.turn, g.legalCards(g.turn)[0]);
  const t = g.lastTrick;
  assert.equal(t.cards.length, 5);
  assert.equal(t.winner, trickWinner(t.cards, g.trump));
  assert.equal(t.points, t.cards.reduce((s, c) => s + points(c.card), 0));
  assert.equal(g.turn, t.winner);
  assert.deepEqual(g.viewFor(2).lastTrick, t);
});

test('viewFor includes you', () => {
  const g = new Game(6, { rng: seeded(6) });
  assert.equal(g.viewFor(3).you, 3);
});

test('1000 random full games finish with correct totals and scores', () => {
  const rng = seeded(7);
  for (let i = 0; i < 1000; i++) {
    const n = 5 + Math.floor(rng() * 5);
    const g = randomGame(n, rng);
    assert.equal(g.phase, 'done');
    assert.equal(g.captured.reduce((a, b) => a + b, 0), 235);
    const holders = g.partnerCards.map((c) => g.initialHands.findIndex((h) => h.includes(c)));
    const team = [...new Set([g.bidder, ...holders])];
    const teamPoints = team.reduce((s, p) => s + g.captured[p], 0);
    const success = teamPoints >= g.bid;
    const expected = Array(n).fill(0);
    if (success) team.forEach((p) => (expected[p] = g.bid));
    else expected[g.bidder] = -g.bid;
    assert.deepEqual(g.result.scores, expected);
    assert.equal(g.result.success, success);
  }
});

test('won records every card a player took, and only the winner of each trick gets them', () => {
  const rng = seeded(41);
  const g = new Game(5, { rng });
  randomBidding(g, rng);
  randomDeclare(g, rng);
  assert.ok(g.won.every((w) => w.length === 0));
  for (let i = 0; i < g.n; i++) g.play(g.turn, g.legalCards(g.turn)[0]);
  const t = g.lastTrick;
  assert.deepEqual(g.won[t.winner].slice().sort(), t.cards.map((c) => c.card).sort());
  assert.equal(g.won.flat().length, 5);
  assert.deepEqual(g.viewFor(0).won[t.winner].slice().sort(), t.cards.map((c) => c.card).sort());
});

test('won cards always add up to the captured points (random games)', () => {
  const rng = seeded(42);
  for (let i = 0; i < 200; i++) {
    const g = randomGame(5 + Math.floor(rng() * 5), rng);
    for (let p = 0; p < g.n; p++) {
      assert.equal(g.won[p].reduce((s, c) => s + points(c), 0), g.captured[p]);
    }
    assert.equal(g.won.flat().length, g.n * g.initialHands[0].length);
  }
});

test('everyone\'s dealt hands are only revealed once the round is done', () => {
  const rng = seeded(43);
  const g = new Game(6, { rng });
  assert.equal(g.viewFor(0).allHands, null);
  randomBidding(g, rng);
  assert.equal(g.viewFor(0).allHands, null);
  randomDeclare(g, rng);
  assert.equal(g.viewFor(0).allHands, null);
  g.play(g.turn, g.legalCards(g.turn)[0]);
  assert.equal(g.viewFor(0).allHands, null, 'still hidden mid-round');
  randomPlay(g, rng);
  assert.deepEqual(g.viewFor(0).allHands, g.initialHands);
});
