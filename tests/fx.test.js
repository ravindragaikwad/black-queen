'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cues, delta, createFx } = require('../fx');

const hands = (...sizes) => sizes;
const st = ({ phase = 'play', handSizes = hands(8, 8, 8, 8, 8, 8), paused = false, completedTrick = null, scores = null } = {}) => ({
  view: { phase, handSizes, result: scores ? { scores } : null },
  paused,
  completedTrick,
});
const trick = { cards: [], winner: 3, points: 10 };

test('cues: a brand new round deals', () => {
  assert.deepEqual(cues(null, st({ phase: 'bidding' })), ['deal']);
});

test('cues: nothing changed means no cues', () => {
  assert.deepEqual(cues(st(), st()), []);
});

test('cues: a card played makes the play sound', () => {
  assert.deepEqual(cues(st(), st({ handSizes: hands(7, 8, 8, 8, 8, 8) })), ['play']);
});

test('cues: the card that completes a trick plays then sweeps', () => {
  const next = st({ handSizes: hands(7, 7, 7, 7, 7, 7), completedTrick: trick, paused: true });
  assert.deepEqual(cues(st({ handSizes: hands(7, 7, 7, 7, 7, 8) }), next), ['play', 'sweep']);
});

test('cues: a completed trick that lingers across redraws does not sweep again', () => {
  const a = st({ handSizes: hands(7, 7, 7, 7, 7, 7), completedTrick: trick, paused: true });
  assert.deepEqual(cues(a, { ...a }), []);
});

test('cues: the end of the round wins or loses once, after the last trick pause', () => {
  const lastTrick = st({ phase: 'done', handSizes: hands(0, 0, 0, 0, 0, 0), completedTrick: trick, paused: true, scores: [90, 0, 0, 0, 0, 0] });
  const before = st({ handSizes: hands(1, 1, 1, 1, 1, 0) });
  assert.deepEqual(cues(before, lastTrick), ['play', 'sweep']);
  const won = st({ phase: 'done', handSizes: hands(0, 0, 0, 0, 0, 0), scores: [90, 0, 0, 90, 0, 0] });
  assert.deepEqual(cues(lastTrick, won), ['win']);
  assert.deepEqual(cues(won, { ...won }), []);
  const lost = st({ phase: 'done', handSizes: hands(0, 0, 0, 0, 0, 0), scores: [-90, 0, 0, 0, 0, 0] });
  assert.deepEqual(cues(lastTrick, lost), ['lose']);
  const neutral = st({ phase: 'done', handSizes: hands(0, 0, 0, 0, 0, 0), scores: [0, 0, 0, 90, 0, 0] });
  assert.deepEqual(cues(lastTrick, neutral), []);
});

test('delta: offset between the centres of two boxes', () => {
  const from = { left: 100, top: 200, width: 20, height: 40 }; // centre 110, 220
  const to = { left: 10, top: 20, width: 60, height: 80 }; // centre 40, 60
  assert.deepEqual(delta(from, to), { x: 70, y: 160 });
});

function fakeGsap() {
  const calls = [];
  return { calls, from: (t, v) => calls.push(['from', t, v]), to: (t, v) => calls.push(['to', t, v]) };
}
const box = (left, top, w = 60, h = 88) => ({ getBoundingClientRect: () => ({ left, top, width: w, height: h }) });
const rect = (left, top, w = 60, h = 88) => ({ left, top, width: w, height: h });

test('deal: every card flies in from the table centre, one after another', () => {
  const gsap = fakeGsap();
  const fx = createFx({ gsap, confetti: null, reducedMotion: false });
  fx.deal([box(10, 500), box(80, 500), box(150, 500)], rect(150, 150, 0, 0));
  assert.equal(gsap.calls.length, 3);
  assert.ok(gsap.calls.every(([kind]) => kind === 'from'));
  const delays = gsap.calls.map(([, , v]) => v.delay);
  assert.ok(delays[0] < delays[1] && delays[1] < delays[2], 'staggered');
  assert.ok(gsap.calls.every(([, , v]) => v.clearProps), 'leaves the card clean afterwards');
  assert.equal(gsap.calls[0][2].y, delta(rect(150, 150, 0, 0), rect(10, 500)).y);
});

test('fly: a played card starts where it was and lands in its spot', () => {
  const gsap = fakeGsap();
  const fx = createFx({ gsap, confetti: null, reducedMotion: false });
  const el = box(200, 200, 40, 56);
  fx.fly(el, rect(20, 600));
  assert.equal(gsap.calls.length, 1);
  const [kind, target, vars] = gsap.calls[0];
  assert.equal(kind, 'from');
  assert.equal(target, el);
  assert.deepEqual({ x: vars.x, y: vars.y }, delta(rect(20, 600), rect(200, 200, 40, 56)));
});

test('sweep: the trick slides to the winner and fades out', () => {
  const gsap = fakeGsap();
  const fx = createFx({ gsap, confetti: null, reducedMotion: false });
  fx.sweep([box(100, 100, 40, 56), box(200, 120, 40, 56)], rect(300, 600, 70, 70));
  assert.equal(gsap.calls.length, 2);
  for (const [kind, , vars] of gsap.calls) {
    assert.equal(kind, 'to');
    assert.equal(vars.opacity, 0);
    assert.ok(vars.delay > 0, 'waits so the trick can be seen first');
  }
  const first = gsap.calls[0][2];
  assert.deepEqual({ x: first.x, y: first.y }, delta(rect(300, 600, 70, 70), rect(100, 100, 40, 56)));
});

test('celebrate fires confetti', () => {
  const calls = [];
  const fx = createFx({ gsap: fakeGsap(), confetti: (o) => calls.push(o), reducedMotion: false });
  fx.celebrate();
  assert.ok(calls.length >= 1 && calls[0].particleCount > 0);
});

test('reduced motion turns every animation and the confetti off', () => {
  const gsap = fakeGsap();
  const calls = [];
  const fx = createFx({ gsap, confetti: (o) => calls.push(o), reducedMotion: true });
  fx.deal([box(0, 0)], rect(0, 0, 0, 0));
  fx.fly(box(0, 0), rect(5, 5));
  fx.sweep([box(0, 0)], rect(9, 9));
  fx.celebrate();
  assert.equal(gsap.calls.length, 0);
  assert.equal(calls.length, 0);
});

test('missing libraries are safe no-ops', () => {
  const fx = createFx({ gsap: undefined, confetti: undefined, reducedMotion: false });
  assert.doesNotThrow(() => {
    fx.deal([box(0, 0)], rect(0, 0, 0, 0));
    fx.fly(box(0, 0), rect(5, 5));
    fx.sweep([box(0, 0)], rect(9, 9));
    fx.celebrate();
  });
});

test('an animation that throws never breaks the game', () => {
  const boom = { from() { throw new Error('x'); }, to() { throw new Error('x'); } };
  const fx = createFx({ gsap: boom, confetti: () => { throw new Error('x'); }, reducedMotion: false });
  assert.doesNotThrow(() => {
    fx.deal([box(0, 0)], rect(0, 0, 0, 0));
    fx.fly(box(0, 0), rect(5, 5));
    fx.sweep([box(0, 0)], rect(9, 9));
    fx.celebrate();
  });
});
