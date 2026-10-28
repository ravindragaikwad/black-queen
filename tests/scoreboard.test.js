'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const sb = require('../scoreboard');

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

test('applyRound adds per seat and does not mutate', () => {
  const start = sb.newScoreboard(5);
  const next = sb.applyRound(start, [90, 0, -90, 0, 90]);
  assert.deepEqual(next.totals, [90, 0, -90, 0, 90]);
  assert.equal(next.rounds, 1);
  assert.deepEqual(start.totals, [0, 0, 0, 0, 0]);
  assert.equal(start.rounds, 0);
  assert.deepEqual(sb.applyRound(next, [10, 10, 10, 10, 10]).totals, [100, 10, -80, 10, 100]);
});

test('save then load round-trips', () => {
  const storage = memoryStorage();
  const board = sb.applyRound(sb.newScoreboard(6), [75, 0, 0, 75, 0, 0]);
  assert.equal(sb.saveScoreboard(storage, board), true);
  assert.deepEqual(sb.loadScoreboard(storage), board);
});

test('load returns null when there is no saved scoreboard', () => {
  assert.equal(sb.loadScoreboard(memoryStorage()), null);
});

test('load returns null for invalid JSON', () => {
  assert.equal(sb.loadScoreboard(memoryStorage({ 'blackqueen.scoreboard.v1': '{oops' })), null);
});

test('load returns null for the wrong shape', () => {
  const key = 'blackqueen.scoreboard.v1';
  const bad = [
    { names: ['You', 'Asha'], totals: [0], rounds: 0 },
    { names: ['You', 'Asha'], totals: [0, 'x'], rounds: 0 },
    { names: 'You', totals: [0], rounds: 0 },
    { names: ['You'], totals: [0], rounds: -1 },
    null,
    42,
  ];
  for (const b of bad) {
    assert.equal(sb.loadScoreboard(memoryStorage({ [key]: JSON.stringify(b) })), null, JSON.stringify(b));
  }
});

test('load returns null when storage throws', () => {
  const broken = { getItem() { throw new Error('blocked'); } };
  assert.equal(sb.loadScoreboard(broken), null);
});

test('save returns false instead of throwing when storage is unavailable', () => {
  const broken = { setItem() { throw new Error('quota'); } };
  assert.equal(sb.saveScoreboard(broken, sb.newScoreboard(5)), false);
});

test('clearScoreboard removes the saved scoreboard and never throws', () => {
  const storage = memoryStorage();
  sb.saveScoreboard(storage, sb.newScoreboard(5));
  sb.clearScoreboard(storage);
  assert.equal(sb.loadScoreboard(storage), null);
  assert.doesNotThrow(() => sb.clearScoreboard({ removeItem() { throw new Error('x'); } }));
});

test('botNames(9) has 9 fixed names with You first; botNames(5) is a prefix', () => {
  const nine = sb.botNames(9);
  assert.equal(nine.length, 9);
  assert.equal(nine[0], 'You');
  assert.deepEqual(nine.slice(1), ['Asha', 'Dev', 'Mira', 'Kabir', 'Zoya', 'Rohan', 'Priya', 'Sam']);
  assert.deepEqual(sb.botNames(5), nine.slice(0, 5));
});

test('bot level: defaults to smart, saves and restores the choice, ignores junk', () => {
  const storage = memoryStorage();
  assert.equal(sb.loadLevel(storage), 'smart');
  assert.equal(sb.saveLevel(storage, 'easy'), true);
  assert.equal(sb.loadLevel(storage), 'easy');
  assert.equal(sb.saveLevel(storage, 'medium'), true);
  assert.equal(sb.loadLevel(storage), 'medium');
  assert.equal(sb.saveLevel(storage, 'smart'), true);
  assert.equal(sb.loadLevel(storage), 'smart');
  assert.equal(sb.saveLevel(storage, 'genius'), false, 'unknown levels are refused');
  assert.equal(sb.loadLevel(memoryStorage({ 'blackqueen.level.v1': 'garbage' })), 'smart');
});

test('bot level: unavailable storage never throws', () => {
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(sb.loadLevel(broken), 'smart');
  assert.equal(sb.saveLevel(broken, 'easy'), false);
});
