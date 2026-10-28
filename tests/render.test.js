'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const r = require('../render');
const { botNames, newScoreboard, applyRound } = require('../scoreboard');

const names = botNames(6);

function viewFixture(over = {}) {
  return {
    n: 6, you: 0, phase: 'bidding', turn: 0,
    yourHand: ['AS', 'KS', 'QH', '10H', '5D', '9C', '7C', '3D'],
    handSizes: [8, 8, 8, 8, 8, 8],
    highBid: null, highBidder: null, bidder: null, bid: null, trump: null,
    partnerCards: [], revealedPartners: [], trick: [], lastTrick: null,
    captured: [0, 0, 0, 0, 0, 0], won: [[], [], [], [], [], []], allHands: null,
    removed: ['2D', '2C', '2H', '2S'], result: null,
    ...over,
  };
}

function ctxFixture({ view = {}, state = {}, ...over } = {}) {
  return {
    screen: 'game', names, selected: null, bidAmount: 0, trump: null, partnerPicks: [],
    setup: { n: 6, savedMismatch: false }, scoreboard: newScoreboard(6),
    state: {
      view: viewFixture(view), userTurn: true, paused: false, completedTrick: null,
      bids: [null, null, null, null, null, null], ...state,
    },
    ...over,
  };
}

const cardTags = (html) => html.match(/<button class="card[^>]*>/g) || [];
const rowsOf = (html) => html.split('<div class="hand-row">').slice(1);

const TEN = ['AS', 'KS', 'QS', 'JS', '10S', 'AH', 'KH', 'QH', 'JH', '10H'];
const handOpts = (o = {}) => ({ legal: TEN, selected: null, partnerCards: [], enabled: true, ...o });

test('10-card hand renders two rows of 5; 5-card hand renders one row', () => {
  const ten = rowsOf(r.renderHand(TEN, handOpts()));
  assert.equal(ten.length, 2);
  assert.ok(ten.every((row) => cardTags(row).length === 5));
  const five = rowsOf(r.renderHand(TEN.slice(0, 5), handOpts()));
  assert.equal(five.length, 1);
  assert.equal(cardTags(five[0]).length, 5);
});

test('no row ever holds more than 5 cards, for any hand size', () => {
  for (let k = 1; k <= 10; k++) {
    const rows = rowsOf(r.renderHand(TEN.slice(0, k), handOpts()));
    assert.ok(rows.every((row) => cardTags(row).length <= 5), `size ${k}`);
  }
});

test('illegal cards are aria-disabled with no data-action', () => {
  const tags = cardTags(r.renderHand(TEN, handOpts({ legal: ['AS', 'KS'] })));
  const enabled = tags.filter((t) => t.includes('data-action'));
  assert.equal(enabled.length, 2);
  assert.equal(tags.filter((t) => t.includes('aria-disabled="true"')).length, 8);
  assert.deepEqual(enabled.map((t) => t.match(/data-card="([^"]+)"/)[1]).sort(), ['AS', 'KS']);
});

test('when enabled is false no card is actionable', () => {
  const tags = cardTags(r.renderHand(TEN, handOpts({ enabled: false })));
  assert.equal(tags.length, 10);
  assert.ok(tags.every((t) => !t.includes('data-action') && t.includes('aria-disabled="true"')));
});

test('selected card has class selected and play action; others select', () => {
  const tags = cardTags(r.renderHand(TEN, handOpts({ selected: 'KH' })));
  const sel = tags.filter((t) => t.includes('selected'));
  assert.equal(sel.length, 1);
  assert.ok(sel[0].includes('data-action="play"') && sel[0].includes('data-card="KH"'));
  const others = tags.filter((t) => !t.includes('selected'));
  assert.ok(others.every((t) => t.includes('data-action="select"')));
});

test('a named partner card in the user hand has class partner-card', () => {
  const tags = cardTags(r.renderHand(TEN, handOpts({ partnerCards: ['AH'] })));
  const marked = tags.filter((t) => t.includes('partner-card'));
  assert.equal(marked.length, 1);
  assert.ok(marked[0].includes('data-card="AH"'));
});

test('partner holder is not marked until revealed', () => {
  const play = { phase: 'play', bidder: 2, bid: 90, trump: 'H', partnerCards: ['KH'], turn: 0 };
  const hidden = r.renderScreen(ctxFixture({ view: { ...play, revealedPartners: [] } }));
  assert.ok(!hidden.includes('badge-partner'), 'no partner badge yet');
  assert.ok(hidden.includes('K♥'), 'named partner card is public');
  const shown = r.renderScreen(ctxFixture({ view: { ...play, revealedPartners: [3] } }));
  assert.ok(shown.includes('badge-partner'));
  assert.match(shown, new RegExp(`data-seat="3"[^]*?badge-partner`));
});

test('playing screen never contains another player hand', () => {
  const html = r.renderScreen(ctxFixture({ view: { phase: 'play', bidder: 1, bid: 80, trump: 'S', partnerCards: ['AH'] } }));
  const cardsShown = cardTags(html).map((t) => t.match(/data-card="([^"]+)"/)).filter(Boolean).map((m) => m[1]);
  assert.ok(cardsShown.every((c) => viewFixture().yourHand.includes(c)));
});

test('tapping is impossible when it is not the user turn or during the pause', () => {
  const notTurn = r.renderScreen(ctxFixture({ view: { phase: 'play', turn: 3, bidder: 1, trump: 'S' }, state: { userTurn: false } }));
  assert.ok(cardTags(notTurn).every((t) => !t.includes('data-action')));
  const paused = r.renderScreen(ctxFixture({ view: { phase: 'play', turn: 0, bidder: 1, trump: 'S' }, state: { userTurn: false, paused: true } }));
  assert.ok(cardTags(paused).every((t) => !t.includes('data-action')));
});

test('bidding screen shows each seat bid or pass and controls only on the user turn', () => {
  const bids = [null, 'pass', 85, null, null, null];
  const mine = r.renderScreen(ctxFixture({ view: { highBid: 85, highBidder: 2 }, state: { bids } }));
  assert.ok(mine.includes('pass') && mine.includes('85'));
  assert.ok(mine.includes('data-action="bid"') && mine.includes('data-action="pass"'));
  assert.ok(mine.includes('90'), 'default amount is highBid + 5');
  const theirs = r.renderScreen(ctxFixture({ view: { turn: 2, highBid: 85, highBidder: 2 }, state: { bids, userTurn: false } }));
  assert.ok(!theirs.includes('data-action="bid"') && !theirs.includes('data-action="pass"'));
});

test('bidding default amount is the minimum bid when nobody has bid', () => {
  const html = r.renderScreen(ctxFixture());
  assert.match(html, /class="bid-amount"[^>]*>75</);
});

test('declare screen offers exactly partnerCount(n) picks and only in-play cards', () => {
  const html = r.renderScreen(ctxFixture({ trump: 'H', partnerPicks: ['AS'], view: { phase: 'declare', bidder: 0, bid: 90, turn: 0 } }));
  assert.ok(html.includes('1 partner card'), 'asks for 1 partner card at 6 players');
  assert.ok(html.includes('data-action="pick-trump"'));
  assert.ok(!html.includes('data-card="2S"') && !html.includes('data-card="2D"'), 'removed cards not offered');
  assert.ok(html.includes('data-card="AS"'));
  assert.ok(html.includes('data-action="declare"'));
});

test('declare action is unavailable until trump and every partner card are chosen', () => {
  const view = { phase: 'declare', bidder: 0, bid: 90, turn: 0 };
  const incomplete = r.renderScreen(ctxFixture({ trump: 'H', partnerPicks: [], view }));
  assert.ok(!incomplete.includes('data-action="declare"'));
  const complete = r.renderScreen(ctxFixture({ trump: 'H', partnerPicks: ['AS'], view }));
  assert.ok(complete.includes('data-action="declare"'));
});

test('when a bot is declaring, the user sees who won and no declare controls', () => {
  const html = r.renderScreen(ctxFixture({ view: { phase: 'declare', bidder: 3, bid: 85, turn: 3 }, state: { userTurn: false } }));
  assert.ok(html.includes(names[3]) && html.includes('85'));
  assert.ok(!html.includes('data-action="declare"'));
});

test('result screen shows made/missed, bid, team points, team names, round change and total', () => {
  const result = { team: [0, 3], teamPoints: 105, bid: 90, success: true, scores: [90, 0, 0, 90, 0, 0] };
  const board = applyRound(newScoreboard(6), result.scores);
  const html = r.renderScreen(ctxFixture({
    screen: 'result', scoreboard: board,
    view: { phase: 'done', bidder: 0, bid: 90, result },
  }));
  assert.ok(/made/i.test(html));
  assert.ok(html.includes('105') && html.includes('90'));
  assert.ok(html.includes(names[3]));
  assert.ok(html.includes('+90'));
  assert.ok(html.includes('data-action="next-round"') && html.includes('data-action="stop"'));
  const missed = r.renderScreen(ctxFixture({
    screen: 'result', scoreboard: board,
    view: { phase: 'done', bidder: 2, bid: 100, result: { team: [2], teamPoints: 60, bid: 100, success: false, scores: [0, 0, -100, 0, 0, 0] } },
  }));
  assert.ok(/missed/i.test(missed) && missed.includes('-100'));
});

test('setup lists player counts and starts; a mismatch asks to reset', () => {
  const plain = r.renderScreen(ctxFixture({ screen: 'setup' }));
  for (const n of [5, 6, 7, 8, 9]) assert.ok(plain.includes(`data-n="${n}"`));
  assert.ok(plain.includes('data-action="start"'));
  assert.ok(!plain.includes('data-action="confirm-reset"'));
  const mismatch = r.renderScreen(ctxFixture({ screen: 'setup', setup: { n: 7, savedMismatch: true } }));
  assert.ok(mismatch.includes('data-action="confirm-reset"') && mismatch.includes('data-action="cancel-reset"'));
  assert.ok(!mismatch.includes('data-action="start"'));
});

test('setup offers reset-scoreboard once rounds have been played', () => {
  const fresh = r.renderScreen(ctxFixture({ screen: 'setup' }));
  assert.ok(!fresh.includes('data-action="reset-scoreboard"'));
  const played = r.renderScreen(ctxFixture({ screen: 'setup', scoreboard: applyRound(newScoreboard(6), [75, 0, 0, 75, 0, 0]) }));
  assert.ok(played.includes('data-action="reset-scoreboard"'));
});

test('reset-scoreboard asks for confirmation before anything is cleared', () => {
  const played = applyRound(newScoreboard(6), [75, 0, 0, 75, 0, 0]);
  const asking = r.renderScreen(ctxFixture({
    screen: 'setup', scoreboard: played, setup: { n: 6, savedMismatch: false, confirmScoreboardReset: true },
  }));
  assert.ok(asking.includes('data-action="confirm-scoreboard-reset"'));
  assert.ok(asking.includes('data-action="cancel-scoreboard-reset"'));
  assert.ok(!asking.includes('data-action="reset-scoreboard"'), 'the first-step button is replaced by the prompt');
  assert.ok(asking.includes('1 round'), 'says how much would be lost');
});

test('seatPosition puts seat 0 at the bottom centre and the rest around the table clockwise', () => {
  for (const n of [5, 6, 7, 8, 9]) {
    const spots = Array.from({ length: n }, (_, i) => r.seatPosition(i, n));
    assert.equal(spots[0].left, 50, `n=${n} seat 0 centred`);
    assert.ok(spots[0].top > 60, `n=${n} seat 0 at the bottom`);
    assert.equal(new Set(spots.map((s) => `${s.left},${s.top}`)).size, n, `n=${n} all seats distinct`);
    assert.ok(spots.every((s) => s.left > 0 && s.left < 100 && s.top > 0 && s.top < 100), 'inside the table');
    assert.ok(spots[1].left < 50, 'next seat clockwise is on the left side');
  }
});

test('seatPosition with a smaller radius moves toward the centre', () => {
  const edge = r.seatPosition(3, 6);
  const inner = r.seatPosition(3, 6, 0.5);
  assert.ok(Math.abs(inner.left - 50) < Math.abs(edge.left - 50) + 0.01);
  assert.ok(Math.abs(inner.top - 50) < Math.abs(edge.top - 50) + 0.01);
});

test('seats are placed around a round table', () => {
  const html = r.renderScreen(ctxFixture({ view: { phase: 'play', bidder: 1, bid: 80, trump: 'S', partnerCards: ['AH'] } }));
  assert.ok(html.includes('class="table"'));
  const seatTags = html.match(/<div class="seat[^>]*>/g);
  assert.equal(seatTags.length, 6);
  assert.ok(seatTags.every((t) => /style="left:[\d.]+%;top:[\d.]+%/.test(t)));
});

test('cards in the current trick sit in front of the player who played them', () => {
  const trick = [{ player: 2, card: '9H' }, { player: 4, card: 'KH' }];
  const html = r.renderScreen(ctxFixture({ view: { phase: 'play', bidder: 1, bid: 80, trump: 'S', partnerCards: ['AH'], trick } }));
  const played = html.match(/<div class="trick-card[^>]*>/g);
  assert.equal(played.length, 2);
  assert.ok(played.every((t) => /style="left:[\d.]+%;top:[\d.]+%/.test(t)));
  assert.ok(html.includes('9♥') && html.includes('K♥'));
});

test('hand cards and played cards are drawn as card faces', () => {
  const hand = r.renderHand(TEN, handOpts());
  assert.equal((hand.match(/<svg class="face-svg/g) || []).length, 10);
  const trick = [{ player: 2, card: '9H' }];
  const html = r.renderScreen(ctxFixture({ view: { phase: 'play', bidder: 1, bid: 80, trump: 'S', partnerCards: ['AH'], trick } }));
  assert.match(html, /<div class="trick-card[^>]*>\s*<span class="card mini[^>]*><svg class="face-svg/);
  assert.ok(html.includes('aria-label="9♥"'));
});

test('every screen has a sound button that reflects the mute state', () => {
  const resultView = { phase: 'done', bidder: 0, bid: 90, result: { team: [0], teamPoints: 100, bid: 90, success: true, scores: [90, 0, 0, 0, 0, 0] } };
  const screens = [
    ctxFixture({ screen: 'setup' }),
    ctxFixture(),
    ctxFixture({ screen: 'result', view: resultView }),
  ];
  for (const ctx of screens) {
    assert.match(r.renderScreen(ctx), /data-action="toggle-sound"[^>]*aria-pressed="true"/, 'sound on by default');
    assert.match(r.renderScreen({ ...ctx, muted: true }), /data-action="toggle-sound"[^>]*aria-pressed="false"/, 'muted');
  }
});

test('played cards are tagged with the player who played them', () => {
  const trick = [{ player: 2, card: '9H' }, { player: 4, card: 'KH' }];
  const html = r.renderScreen(ctxFixture({ view: { phase: 'play', bidder: 1, bid: 80, trump: 'S', partnerCards: ['AH'], trick } }));
  assert.ok(html.includes('data-player="2"') && html.includes('data-player="4"'));
});

const tileFor = (html, seat) => (html.match(new RegExp(`<div class="seat[^>]*data-seat="${seat}"[^]*?</div>`)) || [''])[0];
const playView = { phase: 'play', bidder: 1, bid: 80, trump: 'S', partnerCards: ['AH'] };

test('under a player\'s name: the point cards they have won, but not worthless cards', () => {
  const won = [[], [], ['10C', '3D', 'KH'], [], [], []];
  const html = r.renderScreen(ctxFixture({ view: { ...playView, won, captured: [0, 0, 20, 0, 0, 0] } }));
  const tile = tileFor(html, 2);
  assert.ok(tile.includes('10♣') && tile.includes('K♥'), 'point cards shown');
  assert.ok(!tile.includes('3♦'), 'worthless cards are not listed');
  assert.ok(tile.includes('20 pts'), 'total still shown');
  assert.ok(!tileFor(html, 3).includes('won-chip'), 'nothing for a player who has won nothing');
});

test('a long list of won point cards is shortened to four plus a count', () => {
  const won = [[], [], ['AH', 'KH', 'QH', 'JH', '10H', '5H'], [], [], []];
  const tile = tileFor(r.renderScreen(ctxFixture({ view: { ...playView, won } })), 2);
  assert.equal((tile.match(/class="won-chip/g) || []).length, 4);
  assert.ok(tile.includes('+2'));
});

test('the queen of spades is flagged among the won cards', () => {
  const won = [[], [], ['QS'], [], [], []];
  const tile = tileFor(r.renderScreen(ctxFixture({ view: { ...playView, won } })), 2);
  assert.ok(tile.includes('won-chip queen'));
});

test('the trick caption says which point cards the winner took', () => {
  const completedTrick = { cards: [{ player: 1, card: '10C' }, { player: 2, card: '3D' }], winner: 1, points: 10 };
  const html = r.renderScreen(ctxFixture({ view: { ...playView, won: [[], ['10C', '3D'], [], [], [], []] }, state: { completedTrick, paused: true, userTurn: false } }));
  const caption = html.match(/<p class="note">[^<]*wins the trick[^<]*<\/p>/)[0];
  assert.ok(caption.includes('10♣') && caption.includes('+10'));
  assert.ok(!caption.includes('3♦'));
});

const reviewHands = [
  ['AS', 'KS', 'QS', 'JS', '10S', '9S', '8S', '7S'], ['AH', 'KH', 'QH', 'JH', '10H', '9H', '8H', '7H'],
  ['AD', 'KD', 'QD', 'JD', '10D', '9D', '8D', '7D'], ['AC', 'KC', 'QC', 'JC', '10C', '9C', '8C', '7C'],
  ['6S', '6H', '6D', '6C', '5S', '5H', '5D', '5C'], ['4S', '4H', '4D', '4C', '3S', '3H', '3D', '3C'],
];
const doneView = {
  phase: 'done', bidder: 1, bid: 90, trump: 'H', partnerCards: ['AD'], revealedPartners: [2], handSizes: [0, 0, 0, 0, 0, 0],
  allHands: reviewHands, won: [[], ['AH', 'KH'], ['10C'], [], [], []], captured: [0, 20, 10, 0, 0, 0],
  result: { team: [1, 2], teamPoints: 30, bid: 90, success: false, scores: [0, -90, 0, 0, 0, 0] },
};

test('review screen: round complete, every player\'s dealt cards, and a button on to the result', () => {
  const html = r.renderScreen(ctxFixture({ screen: 'review', view: doneView, state: { userTurn: false } }));
  assert.ok(/Round complete/i.test(html));
  assert.ok(html.includes('data-action="show-result"'));
  assert.equal((html.match(/<svg class="face-svg/g) || []).length, 48, 'all 48 dealt cards are shown');
  for (const name of names) assert.ok(html.includes(name));
  assert.ok(html.includes('badge-bidder') && html.includes('badge-partner'), 'who was on the bidding team');
  assert.ok(tileFor(html, 1).includes('A♥'), 'points won still shown at the table');
});

test('result screen can go back to the table and lists the point cards each player won', () => {
  const board = applyRound(newScoreboard(6), doneView.result.scores);
  const html = r.renderScreen(ctxFixture({ screen: 'result', scoreboard: board, view: doneView, state: { userTurn: false } }));
  assert.ok(html.includes('data-action="view-table"'));
  assert.ok(html.includes('data-action="next-round"'));
  const row = (html.match(/<tr><td>Asha[^]*?<\/tr>/) || [''])[0];
  assert.ok(row.includes('A♥') && row.includes('K♥'), 'Won column lists the cards');
});
