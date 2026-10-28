'use strict';
// Black Queen game logic. Pure JS, no dependencies. Works in Node and browsers.
// Cards are strings like "10S", "QH", "AD". Suits: S H D C. Players are indexed 0..n-1 clockwise.
(function (root) {

const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_STRENGTH = { J: 11, Q: 12, K: 13, A: 14 };
const MAX_BID = 125;
const BID_STEP = 5;
const MIN_PLAYERS = 5;

const rankOf = (id) => id.slice(0, -1);
const suitOf = (id) => id.slice(-1);
const strength = (id) => {
  const r = rankOf(id);
  return RANK_STRENGTH[r] || parseInt(r, 10);
};

function points(id) {
  if (id === 'QS') return 25;
  const r = rankOf(id);
  if (['J', 'Q', 'K', 'A', '10'].includes(r)) return 10;
  if (r === '5') return 5;
  return 0;
}

const fullDeck = () => SUITS.flatMap((s) => RANKS.map((r) => r + s));

// 2D 2C 2H 2S 3D 3C 3H 3S 4D 4C 4H 4S
const REMOVAL_ORDER = ['2', '3', '4'].flatMap((r) => ['D', 'C', 'H', 'S'].map((s) => r + s));

const minBid = (n) => (n === MIN_PLAYERS ? 70 : 75);
const partnerCount = (n) => Math.floor((n - 3) / 2);

function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function deal(n, rng = Math.random) {
  if (n < MIN_PLAYERS) throw new Error(`Need at least ${MIN_PLAYERS} players`);
  const perPlayer = Math.floor(52 / n);
  const removeCount = 52 - perPlayer * n;
  if (removeCount > REMOVAL_ORDER.length) throw new Error('Too many players for this removal scheme');
  const removed = REMOVAL_ORDER.slice(0, removeCount);
  const deck = shuffle(fullDeck().filter((c) => !removed.includes(c)), rng);
  const hands = Array.from({ length: n }, (_, i) => deck.slice(i * perPlayer, (i + 1) * perPlayer));
  return { hands, removed, perPlayer };
}

// Cards a player may play: must follow the led suit if able.
function legalCards(hand, trick) {
  if (trick.length === 0) return hand.slice();
  const led = suitOf(trick[0].card);
  const follow = hand.filter((c) => suitOf(c) === led);
  return follow.length ? follow : hand.slice();
}

// Seat currently winning a (possibly partial) trick: highest trump, else highest of the led suit.
function trickWinner(trick, trump) {
  const led = suitOf(trick[0].card);
  const trumps = trick.filter((t) => suitOf(t.card) === trump);
  const pool = trumps.length ? trumps : trick.filter((t) => suitOf(t.card) === led);
  return pool.reduce((a, b) => (strength(b.card) > strength(a.card) ? b : a)).player;
}

// Team points >= bid is a success: bidder and each partner get +bid, otherwise bidder gets -bid.
function scoreRound({ bid, bidder, team, captured, n }) {
  const teamPoints = team.reduce((s, p) => s + captured[p], 0);
  const success = teamPoints >= bid;
  const scores = Array(n).fill(0);
  if (success) team.forEach((p) => (scores[p] = bid));
  else scores[bidder] = -bid;
  return { teamPoints, success, scores };
}

class Game {
  constructor(n, { rng = Math.random } = {}) {
    this.n = n;
    this.rng = rng;
    const d = deal(n, rng);
    this.hands = d.hands;
    this.initialHands = d.hands.map((h) => h.slice());
    this.removed = d.removed;
    this.phase = 'bidding';
    this.active = Array(n).fill(true);
    this.turn = Math.floor(rng() * n);
    this.highBid = null;
    this.highBidder = null;
    this.bidder = null;
    this.bid = null;
    this.trump = null;
    this.partnerCards = [];
    this.trick = [];
    this.lastTrick = null;
    this.captured = Array(n).fill(0);
    this.revealed = new Set();
    this.result = null;
  }

  _need(phase, player) {
    if (this.phase !== phase) throw new Error(`Not in ${phase} phase`);
    if (player !== this.turn) throw new Error('Not your turn');
  }

  _next(i) {
    let j = (i + 1) % this.n;
    while (!this.active[j]) j = (j + 1) % this.n;
    return j;
  }

  placeBid(player, amount) {
    this._need('bidding', player);
    const floor = this.highBid === null ? minBid(this.n) : this.highBid + BID_STEP;
    if (amount < floor) throw new Error(`Bid must be at least ${floor}`);
    if (amount > MAX_BID) throw new Error(`Max bid is ${MAX_BID}`);
    if (amount % BID_STEP !== 0) throw new Error(`Bids go in steps of ${BID_STEP}`);
    this.highBid = amount;
    this.highBidder = player;
    if (amount === MAX_BID) return this._endBidding();
    this.turn = this._next(player);
  }

  pass(player) {
    this._need('bidding', player);
    this.active[player] = false;
    if (this.active.filter(Boolean).length === 1) return this._endBidding();
    this.turn = this._next(player);
  }

  _endBidding() {
    const lastActive = this.active.indexOf(true);
    this.bidder = this.highBidder !== null ? this.highBidder : lastActive;
    this.bid = this.highBid !== null ? this.highBid : minBid(this.n);
    this.turn = this.bidder;
    this.phase = 'declare';
  }

  declare(player, trump, partnerCards) {
    this._need('declare', player);
    if (!SUITS.includes(trump)) throw new Error('Invalid trump suit');
    if (partnerCards.length !== partnerCount(this.n)) {
      throw new Error(`Name exactly ${partnerCount(this.n)} partner card(s)`);
    }
    if (new Set(partnerCards).size !== partnerCards.length) throw new Error('Partner cards must differ');
    for (const c of partnerCards) {
      if (!this.initialHands.some((h) => h.includes(c))) throw new Error(`${c} is not in play`);
    }
    this.trump = trump;
    this.partnerCards = partnerCards.slice();
    this.phase = 'play';
    this.turn = this.bidder; // bidder leads
  }

  legalCards(player) {
    return legalCards(this.hands[player], this.trick);
  }

  play(player, card) {
    this._need('play', player);
    if (!this.hands[player].includes(card)) throw new Error('You do not hold that card');
    if (!this.legalCards(player).includes(card)) throw new Error('Must follow suit');
    this.hands[player] = this.hands[player].filter((c) => c !== card);
    this.trick.push({ player, card });
    if (this.partnerCards.includes(card)) this.revealed.add(player);
    if (this.trick.length < this.n) {
      this.turn = (player + 1) % this.n;
      return;
    }
    this._resolveTrick();
  }

  _resolveTrick() {
    const winner = trickWinner(this.trick, this.trump);
    const trickPoints = this.trick.reduce((s, t) => s + points(t.card), 0);
    this.captured[winner] += trickPoints;
    this.lastTrick = { cards: this.trick, winner, points: trickPoints };
    this.trick = [];
    if (this.hands.every((h) => h.length === 0)) return this._finish();
    this.turn = winner;
  }

  teamMembers() {
    const team = new Set([this.bidder]);
    for (const c of this.partnerCards) {
      const holder = this.initialHands.findIndex((h) => h.includes(c));
      team.add(holder);
    }
    return [...team];
  }

  _finish() {
    const team = this.teamMembers();
    const { teamPoints, success, scores } = scoreRound({
      bid: this.bid, bidder: this.bidder, team, captured: this.captured, n: this.n,
    });
    this.result = { team, teamPoints, bid: this.bid, success, scores };
    this.phase = 'done';
  }

  // What a given player is allowed to see (use this on the server before sending state).
  viewFor(player) {
    return {
      n: this.n,
      you: player,
      phase: this.phase,
      turn: this.turn,
      yourHand: this.hands[player].slice(),
      handSizes: this.hands.map((h) => h.length),
      highBid: this.highBid,
      highBidder: this.highBidder,
      bidder: this.bidder,
      bid: this.bid,
      trump: this.trump,
      partnerCards: this.partnerCards.slice(),
      revealedPartners: [...this.revealed],
      trick: this.trick.slice(),
      lastTrick: this.lastTrick,
      captured: this.captured.slice(),
      removed: this.removed.slice(),
      result: this.result,
    };
  }
}

const api = {
  Game, deal, points, fullDeck, minBid, partnerCount, shuffle,
  rankOf, suitOf, strength, SUITS, REMOVAL_ORDER, MAX_BID, BID_STEP, MIN_PLAYERS,
  legalCards, trickWinner, scoreRound,
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.BQ = Object.assign(root.BQ || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
