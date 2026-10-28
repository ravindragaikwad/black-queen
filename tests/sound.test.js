'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSound } = require('../sound');

function fakeAudio() {
  const log = { created: 0, started: 0, stopped: 0, resumed: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({
    connect() { return this; }, gain: param(), frequency: param(), Q: param(), type: '', buffer: null,
    start() { log.started++; }, stop() { log.stopped++; },
  });
  class Ctx {
    constructor() { log.created++; this.state = 'suspended'; this.currentTime = 0; this.sampleRate = 8000; this.destination = {}; }
    resume() { log.resumed++; this.state = 'running'; return Promise.resolve(); }
    createGain() { return node(); }
    createOscillator() { return node(); }
    createBiquadFilter() { return node(); }
    createBufferSource() { return node(); }
    createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
  }
  return { Ctx, log };
}

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

const NAMES = ['deal', 'play', 'select', 'sweep', 'win', 'lose'];

test('every sound starts audio and stops every node it started', () => {
  for (const name of NAMES) {
    const { Ctx, log } = fakeAudio();
    const s = createSound({ storage: memoryStorage(), AudioCtx: Ctx });
    s.play(name);
    assert.ok(log.started > 0, `${name} makes sound`);
    assert.equal(log.stopped, log.started, `${name} stops what it starts`);
  }
});

test('muted sound makes no audio and creates no audio context', () => {
  const { Ctx, log } = fakeAudio();
  const s = createSound({ storage: memoryStorage(), AudioCtx: Ctx });
  s.setMuted(true);
  s.play('play');
  assert.equal(log.started, 0);
  assert.equal(log.created, 0);
});

test('the mute choice is saved and restored', () => {
  const storage = memoryStorage();
  const { Ctx } = fakeAudio();
  const a = createSound({ storage, AudioCtx: Ctx });
  assert.equal(a.isMuted(), false);
  a.setMuted(true);
  assert.equal(createSound({ storage, AudioCtx: Ctx }).isMuted(), true);
  assert.equal(a.toggle(), false);
  assert.equal(createSound({ storage, AudioCtx: Ctx }).isMuted(), false);
});

test('the audio context is created lazily and resumed once the user has interacted', () => {
  const { Ctx, log } = fakeAudio();
  const s = createSound({ storage: memoryStorage(), AudioCtx: Ctx });
  assert.equal(log.created, 0);
  s.unlock();
  assert.equal(log.created, 1);
  assert.equal(log.resumed, 1);
  s.play('select');
  assert.equal(log.created, 1, 'one context is reused');
});

test('unknown sound names and a missing AudioContext are safe no-ops', () => {
  const { Ctx, log } = fakeAudio();
  const s = createSound({ storage: memoryStorage(), AudioCtx: Ctx });
  assert.doesNotThrow(() => s.play('nonsense'));
  assert.equal(log.started, 0);
  const none = createSound({ storage: memoryStorage(), AudioCtx: undefined });
  assert.doesNotThrow(() => { none.unlock(); none.play('play'); none.toggle(); });
});

test('unavailable storage does not break sound', () => {
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  const { Ctx, log } = fakeAudio();
  const s = createSound({ storage: broken, AudioCtx: Ctx });
  assert.equal(s.isMuted(), false);
  assert.doesNotThrow(() => s.setMuted(true));
  assert.equal(s.isMuted(), true);
  s.setMuted(false);
  s.play('win');
  assert.ok(log.started > 0);
});

test('a failing audio engine never throws into the game', () => {
  class Bad { constructor() { throw new Error('no audio'); } }
  const s = createSound({ storage: memoryStorage(), AudioCtx: Bad });
  assert.doesNotThrow(() => { s.unlock(); s.play('play'); });
});
