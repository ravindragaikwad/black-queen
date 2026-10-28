'use strict';
// Playing-card faces drawn as inline SVG (original artwork, generated in code). cardSvg("KH") -> "<svg ...>".
(function (root) {
  const RED = '#c0262b';
  const BLACK = '#16181d';
  const SKIN = '#f1c9a1';
  const HAIR = '#6b3b1e';
  const GOLD = '#e0b04a';
  const GOLD_DARK = '#8a6418';
  const PAPER = '#fbf1cf';
  const FONT = "-apple-system, system-ui, 'Helvetica Neue', Arial, sans-serif";

  const SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  // Suit marks, centred on the origin, about 19 units wide.
  const SHAPES = {
    H: '<path d="M0 8 C-10 0 -9 -7 -4.6 -7.2 C-2.2 -7.4 -0.6 -5.8 0 -4 C0.6 -5.8 2.2 -7.4 4.6 -7.2 C9 -7 10 0 0 8 Z"/>',
    D: '<path d="M0 -9 L6.5 0 L0 9 L-6.5 0 Z"/>',
    S: '<path d="M0 -9 C-3 -4.5 -9.5 -1.5 -9.5 3.2 C-9.5 6.6 -5.4 7.6 -2.6 5 C-3 7.6 -4.2 8.8 -5.5 9.4 L5.5 9.4 C4.2 8.8 3 7.6 2.6 5 C5.4 7.6 9.5 6.6 9.5 3.2 C9.5 -1.5 3 -4.5 0 -9 Z"/>',
    C: '<circle cx="0" cy="-4.2" r="4.3"/><circle cx="-4.6" cy="2.2" r="4.3"/><circle cx="4.6" cy="2.2" r="4.3"/><path d="M-1.4 2 L-3.2 9.4 L3.2 9.4 L1.4 2 Z"/>',
  };

  // Pip positions on a 60 x 88 card: columns at x = 20 / 30 / 40.
  const L = 20, C = 30, R = 40;
  const PIPS = {
    2: [[C, 22], [C, 66]],
    3: [[C, 22], [C, 44], [C, 66]],
    4: [[L, 22], [R, 22], [L, 66], [R, 66]],
    5: [[L, 22], [R, 22], [C, 44], [L, 66], [R, 66]],
    6: [[L, 22], [R, 22], [L, 44], [R, 44], [L, 66], [R, 66]],
    7: [[L, 22], [R, 22], [C, 33], [L, 44], [R, 44], [L, 66], [R, 66]],
    8: [[L, 22], [R, 22], [C, 33], [L, 44], [R, 44], [C, 55], [L, 66], [R, 66]],
    9: [[L, 22], [R, 22], [L, 37], [R, 37], [C, 44], [L, 51], [R, 51], [L, 66], [R, 66]],
    10: [[L, 22], [R, 22], [C, 29.5], [L, 37], [R, 37], [L, 51], [R, 51], [C, 58.5], [L, 66], [R, 66]],
  };

  function pip(suit, ink, x, y, scale, { flip = false, ace = false } = {}) {
    const turn = flip ? ' rotate(180)' : '';
    return `<g class="pip${ace ? ' ace' : ''}" transform="translate(${x} ${y})${turn} scale(${scale})" fill="${ink}">${SHAPES[suit]}</g>`;
  }

  // Rank and small suit mark in a corner, repeated upside down in the opposite corner.
  function indices(rank, suit, ink) {
    const size = rank === '10' ? 10 : 12;
    const one =
      `<text x="7.5" y="14" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="${size}" fill="${ink}">${rank}</text>` +
      `<g transform="translate(7.5 21.5) scale(0.42)" fill="${ink}">${SHAPES[suit]}</g>`;
    return `<g class="index">${one}</g><g class="index" transform="rotate(180 30 44)">${one}</g>`;
  }

  // Upper half of a court card; the lower half is the same drawing turned around.
  function courtHalf(rank, suit, ink) {
    const robe = `<path d="M17 44 L19 37 Q30 31 41 37 L43 44 Z" fill="${ink}" stroke="${GOLD}" stroke-width="0.7"/>`;
    const head =
      `<circle cx="30" cy="29" r="5.2" fill="${SKIN}" stroke="#7a5a3a" stroke-width="0.4"/>` +
      '<circle cx="28.1" cy="28.8" r="0.55" fill="#222"/><circle cx="31.9" cy="28.8" r="0.55" fill="#222"/>';
    let extra;
    if (rank === 'K') {
      extra =
        `<path d="M25.6 30.5 Q30 39 34.4 30.5 Q30 33.2 25.6 30.5 Z" fill="${HAIR}"/>` +
        `<path d="M23.6 24.2 L24.6 17.4 L27.6 21 L30 16.2 L32.4 21 L35.4 17.4 L36.4 24.2 Z" fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="0.5"/>`;
    } else if (rank === 'Q') {
      extra =
        `<path d="M24.4 26 Q21.5 34 25 39 L26.4 30 Z" fill="${HAIR}"/><path d="M35.6 26 Q38.5 34 35 39 L33.6 30 Z" fill="${HAIR}"/>` +
        `<path d="M24.2 25 Q30 14.5 35.8 25 Z" fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="0.5"/>` +
        `<circle cx="27.2" cy="21.3" r="0.9" fill="${ink}"/><circle cx="30" cy="19.2" r="0.9" fill="${ink}"/><circle cx="32.8" cy="21.3" r="0.9" fill="${ink}"/>`;
    } else {
      extra =
        `<path d="M34.5 20 Q42.5 12.5 44.5 17.5 Q40.5 16.5 37.5 22.5 Z" fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="0.4"/>` +
        `<path d="M24.6 26.4 Q24.4 17.6 31 17.6 Q36 17.6 35.6 26.4 Z" fill="${ink}"/>` +
        `<rect x="23.6" y="25" width="12.8" height="1.8" fill="${GOLD}"/>`;
    }
    const mark = `<g class="face-suit" transform="translate(18.5 22) scale(0.42)" fill="${ink}">${SHAPES[suit]}</g>`;
    return `${robe}${head}${extra}${mark}`;
  }

  function cardSvg(card) {
    const rank = String(card).slice(0, -1);
    const suit = String(card).slice(-1);
    if (!RANKS.includes(rank) || !SYMBOL[suit]) throw new Error(`Unknown card: ${card}`);
    const ink = suit === 'H' || suit === 'D' ? RED : BLACK;
    let body;
    if (rank === 'A') {
      body = pip(suit, ink, 30, 44, 1.7, { ace: true });
    } else if (rank === 'J' || rank === 'Q' || rank === 'K') {
      const half = courtHalf(rank, suit, ink);
      body =
        `<rect x="12" y="15" width="36" height="58" rx="2.2" fill="${PAPER}" stroke="${ink}" stroke-width="0.8"/>` +
        `<line x1="12" y1="44" x2="48" y2="44" stroke="${ink}" stroke-width="0.4" opacity="0.5"/>` +
        `<g class="figure">${half}</g><g class="figure" transform="rotate(180 30 44)">${half}</g>`;
    } else {
      body = PIPS[rank].map(([x, y]) => pip(suit, ink, x, y, 0.62, { flip: y > 44 })).join('');
    }
    const queenOfSpades = rank === 'Q' && suit === 'S' ? ' queen-spades' : '';
    return `<svg class="face-svg${queenOfSpades}" viewBox="0 0 60 88" role="img" aria-label="${rank}${SYMBOL[suit]}">` +
      `${indices(rank, suit, ink)}${body}</svg>`;
  }

  const api = { cardSvg };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BQ = Object.assign(root.BQ || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
