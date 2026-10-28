'use strict';
// Which sounds and animations a change of game state calls for (cues), and the animations themselves (createFx).
// The animation libraries are passed in, so everything degrades to nothing when they are missing or motion is reduced.
(function (root) {
  const total = (s) => s.view.handSizes.reduce((a, b) => a + b, 0);
  const settled = (s) => !!s && s.view.phase === 'done' && !s.paused;

  // prev is null for a brand new round. Order matters: the card lands before the trick is swept.
  function cues(prev, next) {
    const out = [];
    if (!prev) {
      if (next.view.phase === 'bidding') out.push('deal');
      return out;
    }
    if (total(next) < total(prev)) out.push('play');
    if (next.completedTrick && !prev.completedTrick) out.push('sweep');
    if (settled(next) && !settled(prev)) {
      const mine = next.view.result && next.view.result.scores[0];
      if (mine > 0) out.push('win');
      else if (mine < 0) out.push('lose');
    }
    return out;
  }

  // Offset that moves something sitting at `to`'s centre back to `from`'s centre.
  const centre = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  function delta(from, to) {
    const a = centre(from);
    const b = centre(to);
    return { x: a.x - b.x, y: a.y - b.y };
  }

  const CONFETTI_COLOURS = ['#e0b04a', '#ffffff', '#d8433a', '#22784c'];

  function createFx({ gsap, confetti, reducedMotion }) {
    const animate = (fn) => {
      if (!gsap || reducedMotion) return;
      try {
        fn();
      } catch (e) {
        // an animation problem must never break the game
      }
    };
    const rectOf = (el) => el.getBoundingClientRect();

    return {
      // Hand cards fly in from the middle of the table, one after another.
      deal(cardEls, originRect) {
        animate(() => cardEls.forEach((el, i) => {
          const d = delta(originRect, rectOf(el));
          gsap.from(el, {
            x: d.x, y: d.y, rotation: i % 2 ? 12 : -12, scale: 0.5, opacity: 0,
            duration: 0.45, delay: 0.05 + i * 0.06, ease: 'power2.out', clearProps: 'transform,opacity',
          });
        }));
      },
      // A played card travels from where it was (hand or seat) to its place on the table.
      fly(el, fromRect) {
        animate(() => {
          const d = delta(fromRect, rectOf(el));
          gsap.from(el, { x: d.x, y: d.y, scale: 1.5, duration: 0.35, ease: 'power2.out', clearProps: 'transform,opacity' });
        });
      },
      // The finished trick slides to its winner and fades, after a moment to look at it.
      sweep(trickEls, winnerRect) {
        animate(() => trickEls.forEach((el) => {
          const d = delta(winnerRect, rectOf(el));
          gsap.to(el, { x: d.x, y: d.y, scale: 0.4, opacity: 0, duration: 0.45, delay: 0.7, ease: 'power2.in' });
        }));
      },
      celebrate() {
        if (!confetti || reducedMotion) return;
        try {
          confetti({ particleCount: 90, spread: 70, origin: { x: 0.2, y: 0.7 }, colors: CONFETTI_COLOURS });
          confetti({ particleCount: 90, spread: 70, origin: { x: 0.8, y: 0.7 }, colors: CONFETTI_COLOURS });
        } catch (e) {
          // ignore
        }
      },
    };
  }

  const api = { cues, delta, createFx };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BQ = Object.assign(root.BQ || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
