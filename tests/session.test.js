'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const bq = require('../blackqueen');
const realBots = require('../bot');
const { Session } = require('../session');
const { seeded } = require('./helpers');

function fakeScheduler() {
  const queue = [];
  return {
    schedule: (fn, ms) => queue.push({ fn, ms }),
    pending: () => queue.length,
    peek: () => queue[0],
    runNext() {
      const t = queue.shift();
      t.fn();
      return t.ms;
    },
  };
}

function make(opts = {}) {
  const sched = fakeScheduler();
  const changes = [];
  const session = new Session({
    n: 6,
    rng: seeded(21),
    schedule: sched.schedule,
    onChange: (s) => changes.push(s),
    ...opts,
  });
  return { session, sched, changes };
}

// Run timers until it is the user's turn (or the game is over / paused with nothing queued).
function runToUser(session, sched) {
  for (let i = 0; i < 10000 && sched.pending() && !session.state().userTurn; i++) sched.runNext();
}

// The user takes the first legal option each time.
function userActs(session) {
  const s = session.state();
  const v = s.view;
  if (v.phase === 'bidding') session.userPass();
  else if (v.phase === 'declare') {
    const d = realBots.botDeclare(v);
    session.userDeclare(d.trump, d.partnerCards);
  } else session.userPlay(bq.legalCards(v.yourHand, v.trick)[0]);
}

function playOut(session, sched) {
  for (let i = 0; i < 100000; i++) {
    if (sched.pending()) sched.runNext();
    else if (session.state().userTurn) userActs(session);
    else break;
  }
}

test('bots act after botDelay and stop at the user turn', () => {
  const { session, sched } = make({ rng: () => 0.2 }); // first bidder is seat 1
  session.start();
  assert.equal(sched.pending(), 1);
  assert.equal(sched.peek().ms, 700);
  assert.equal(session.state().userTurn, false);
  runToUser(session, sched);
  const s = session.state();
  assert.equal(s.userTurn, true);
  assert.equal(s.view.turn, 0);
  assert.equal(s.view.phase, 'bidding');
  assert.ok(s.bids.slice(1).every((b) => b === 'pass' || typeof b === 'number'));
  assert.equal(s.bids[0], null);
});

test('user actions throw Not your turn while a bot is thinking, leaving the view unchanged', () => {
  const { session } = make({ rng: () => 0.2 });
  session.start();
  const before = JSON.stringify(session.state());
  assert.throws(() => session.userPass(), /Not your turn/);
  assert.throws(() => session.userBid(80), /Not your turn/);
  assert.throws(() => session.userPlay('AS'), /Not your turn/);
  assert.equal(JSON.stringify(session.state()), before);
});

test('bids array records the latest bid or pass for each seat', () => {
  const { session, sched } = make({ rng: () => 0.2 });
  session.start();
  runToUser(session, sched);
  session.userPass();
  assert.equal(session.state().bids[0], 'pass');
});

test('onChange is called with the state after each change', () => {
  const { session, sched, changes } = make({ rng: () => 0.2 });
  session.start();
  const startCount = changes.length;
  assert.ok(startCount >= 1);
  if (sched.pending()) sched.runNext();
  assert.ok(changes.length > startCount);
});

test('completed trick is held with winner and points, input is refused, then it clears after trickPause', () => {
  const { session, sched } = make();
  session.start();
  let held = null;
  for (let i = 0; i < 100000 && !held; i++) {
    if (sched.pending()) sched.runNext();
    else if (session.state().userTurn) userActs(session);
    else break;
    if (session.state().completedTrick) held = session.state();
  }
  assert.ok(held, 'a trick completed');
  assert.equal(held.paused, true);
  assert.equal(held.userTurn, false);
  assert.equal(held.completedTrick.cards.length, 6);
  assert.equal(held.completedTrick.winner, bq.trickWinner(held.completedTrick.cards, held.view.trump));
  const before = JSON.stringify(session.state());
  assert.throws(() => session.userPlay(held.view.yourHand[0]), /Wait for the trick to finish/);
  assert.equal(JSON.stringify(session.state()), before);
  assert.equal(sched.peek().ms, 1500);
  sched.runNext();
  const after = session.state();
  assert.equal(after.completedTrick, null);
  assert.equal(after.paused, false);
});

test('a full game with the user playing the first legal card ends done with 235 captured', () => {
  for (const n of [5, 9]) {
    const { session, sched } = make({ n, rng: seeded(30 + n) });
    session.start();
    playOut(session, sched);
    const s = session.state();
    assert.equal(s.view.phase, 'done', `n=${n}`);
    assert.equal(s.view.captured.reduce((a, b) => a + b, 0), 235);
    assert.ok(s.view.result);
  }
});

test('when everyone passes and the user is last, the user becomes bidder at the minimum bid', () => {
  const bots = { ...realBots, botBid: () => ({ action: 'pass' }) };
  const { session, sched } = make({ n: 6, rng: () => 0.2, bots }); // order 1,2,3,4,5,0
  session.start();
  runToUser(session, sched);
  const s = session.state();
  assert.equal(s.view.phase, 'declare');
  assert.equal(s.view.bidder, 0);
  assert.equal(s.view.bid, 75);
  assert.equal(s.userTurn, true);
});
