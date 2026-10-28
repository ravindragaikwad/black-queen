'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cardSvg } = require('../cards');
const bq = require('../blackqueen');

const count = (s, re) => (s.match(re) || []).length;
const pips = (svg) => count(svg, /class="pip/g);
const flippedPips = (svg) => count(svg, /class="pip[^"]*" transform="[^"]*rotate\(180\)/g);

test('number cards 2 to 10 show exactly that many pips', () => {
  for (const suit of bq.SUITS) {
    for (let rank = 2; rank <= 10; rank++) {
      assert.equal(pips(cardSvg(`${rank}${suit}`)), rank, `${rank}${suit}`);
    }
  }
});

test('the ace shows one large pip', () => {
  for (const suit of bq.SUITS) {
    const svg = cardSvg(`A${suit}`);
    assert.equal(pips(svg), 1);
    assert.ok(svg.includes('class="pip ace"'));
  }
});

test('lower-half pips are turned upside down like a real card', () => {
  assert.equal(flippedPips(cardSvg('4H')), 2);
  assert.equal(flippedPips(cardSvg('10S')), 5);
  assert.equal(flippedPips(cardSvg('9D')), 4);
  assert.equal(flippedPips(cardSvg('7C')), 2);
  assert.equal(flippedPips(cardSvg('8C')), 3);
  assert.equal(flippedPips(cardSvg('AS')), 0);
});

test('J, Q and K show a figure and no number pips', () => {
  for (const suit of bq.SUITS) {
    for (const r of ['J', 'Q', 'K']) {
      const svg = cardSvg(`${r}${suit}`);
      assert.equal(pips(svg), 0, `${r}${suit} has no number pips`);
      assert.ok(svg.includes('class="figure"'), `${r}${suit} has a figure`);
      assert.ok(svg.includes('class="face-suit"'));
    }
  }
});

test('the three face cards are drawn differently', () => {
  const j = cardSvg('JH');
  const q = cardSvg('QH');
  const k = cardSvg('KH');
  assert.notEqual(j, q);
  assert.notEqual(q, k);
  assert.notEqual(j, k);
});

test('red suits use red ink and black suits do not', () => {
  for (const c of ['AH', '7D', 'KH', 'QD']) assert.ok(cardSvg(c).includes('#c0262b'), c);
  for (const c of ['AS', '7C', 'KS', 'QC']) assert.ok(!cardSvg(c).includes('#c0262b'), c);
});

test('every card carries an accessible name made of rank and suit symbol', () => {
  assert.ok(cardSvg('10S').includes('aria-label="10♠"'));
  assert.ok(cardSvg('KH').includes('aria-label="K♥"'));
  assert.ok(cardSvg('2D').includes('aria-label="2♦"'));
  assert.ok(cardSvg('JC').includes('aria-label="J♣"'));
});

test('the queen of spades is marked as the 25-point card', () => {
  assert.ok(cardSvg('QS').includes('queen-spades'));
  assert.ok(!cardSvg('QH').includes('queen-spades'));
  assert.ok(!cardSvg('KS').includes('queen-spades'));
});

test('all 52 cards give one well-formed svg with no stray values', () => {
  for (const c of bq.fullDeck()) {
    const svg = cardSvg(c);
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), c);
    assert.equal(count(svg, /<svg/g), 1, c);
    assert.equal(count(svg, /<g[\s>]/g), count(svg, /<\/g>/g), `${c} groups balanced`);
    assert.ok(!/undefined|NaN|null/.test(svg), `${c} has no stray values`);
  }
});

test('cardSvg throws on a card it does not know', () => {
  assert.throws(() => cardSvg('1X'));
  assert.throws(() => cardSvg(''));
});
