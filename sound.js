'use strict';
// Game sounds synthesised with the Web Audio API (no audio files). Muting is remembered on the device.
(function (root) {
  const KEY = 'blackqueen.muted.v1';

  function createSound({ storage, AudioCtx }) {
    let muted = false;
    try {
      muted = storage.getItem(KEY) === '1';
    } catch (e) {
      muted = false;
    }
    let ctx = null;
    let failed = false;
    let noise = null;

    // Created on first use: browsers only allow audio after a tap.
    function context() {
      if (ctx || failed || !AudioCtx) return ctx;
      try {
        ctx = new AudioCtx();
      } catch (e) {
        failed = true;
        ctx = null;
      }
      return ctx;
    }

    function wake(c) {
      if (c && c.state === 'suspended') {
        try {
          c.resume();
        } catch (e) {
          // ignore: audio simply stays silent
        }
      }
    }

    function envelope(c, g, at, dur, peak) {
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(peak, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    }

    function tone(c, { type = 'sine', from, to = from, at = 0, dur, peak }) {
      const t = c.currentTime + at;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, t);
      if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
      envelope(c, g, t, dur, peak);
      osc.connect(g).connect(c.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }

    function burst(c, { filter, from, to = from, at = 0, dur, peak }) {
      if (!noise) {
        const n = Math.floor(c.sampleRate * 0.3);
        noise = c.createBuffer(1, n, c.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
      }
      const t = c.currentTime + at;
      const src = c.createBufferSource();
      const f = c.createBiquadFilter();
      const g = c.createGain();
      src.buffer = noise;
      f.type = filter;
      f.frequency.setValueAtTime(from, t);
      if (to !== from) f.frequency.exponentialRampToValueAtTime(to, t + dur);
      envelope(c, g, t, dur, peak);
      src.connect(f).connect(g).connect(c.destination);
      src.start(t);
      src.stop(t + dur + 0.02);
    }

    const RECIPES = {
      select: (c) => tone(c, { type: 'triangle', from: 880, dur: 0.05, peak: 0.08 }),
      play: (c) => {
        burst(c, { filter: 'lowpass', from: 1600, dur: 0.09, peak: 0.5 });
        tone(c, { from: 150, to: 60, dur: 0.12, peak: 0.35 });
      },
      deal: (c) => [0, 0.07, 0.14, 0.21].forEach((at) => burst(c, { filter: 'highpass', from: 2500, at, dur: 0.05, peak: 0.25 })),
      sweep: (c) => burst(c, { filter: 'bandpass', from: 400, to: 2600, dur: 0.28, peak: 0.25 }),
      win: (c) => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, { from: f, at: i * 0.1, dur: 0.35, peak: 0.18 })),
      lose: (c) => {
        tone(c, { type: 'sawtooth', from: 220, to: 110, dur: 0.45, peak: 0.1 });
        tone(c, { type: 'sawtooth', from: 196, to: 98, at: 0.1, dur: 0.45, peak: 0.1 });
      },
    };

    return {
      isMuted: () => muted,
      setMuted(value) {
        muted = !!value;
        try {
          storage.setItem(KEY, muted ? '1' : '0');
        } catch (e) {
          // not saved: the choice still applies for this visit
        }
      },
      toggle() {
        this.setMuted(!muted);
        return muted;
      },
      unlock() {
        if (!muted) wake(context());
      },
      play(name) {
        const recipe = RECIPES[name];
        if (muted || !recipe) return;
        const c = context();
        if (!c) return;
        try {
          wake(c);
          recipe(c);
        } catch (e) {
          // a failing audio engine must never break the game
        }
      },
    };
  }

  const api = { createSound };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BQ = Object.assign(root.BQ || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
