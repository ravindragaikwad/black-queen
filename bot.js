'use strict';
// Simple bot. Decides only from the view returned by Game.viewFor(seat).
(function (root) {
  const bq = typeof require === 'function' ? require('./blackqueen') : root.BQ;
  const { SUITS, MAX_BID, BID_STEP, points, suitOf, strength, fullDeck, partnerCount, minBid, legalCards, trickWinner } = bq;

  const suitCounts = (hand) => SUITS.map((s) => ({ suit: s, count: hand.filter((c) => suitOf(c) === s).length }));
  const handPoints = (hand) => hand.reduce((s, c) => s + points(c), 0);

  // Bid the lowest legal amount while the hand looks strong enough to carry it.
  function botBid(view) {
    const hand = view.yourHand;
    const longest = Math.max(...suitCounts(hand).map((s) => s.count));
    const estimate = handPoints(hand) + 30 + 4 * Math.max(0, longest - 3);
    const willing = Math.min(MAX_BID, Math.floor(estimate / BID_STEP) * BID_STEP);
    const floor = view.highBid === null ? minBid(view.n) : view.highBid + BID_STEP;
    if (floor <= willing) return { action: 'bid', amount: floor };
    return { action: 'pass' };
  }

  // Longest suit as trump (more points breaks ties); name the strongest in-play cards it does not hold.
  function botDeclare(view) {
    const hand = view.yourHand;
    const suitPoints = (s) => handPoints(hand.filter((c) => suitOf(c) === s));
    const trump = suitCounts(hand)
      .sort((a, b) => b.count - a.count || suitPoints(b.suit) - suitPoints(a.suit))[0].suit;
    const partnerCards = fullDeck()
      .filter((c) => !view.removed.includes(c) && !hand.includes(c))
      .sort((a, b) => strength(b) - strength(a) || SUITS.indexOf(suitOf(a)) - SUITS.indexOf(suitOf(b)))
      .slice(0, partnerCount(view.n));
    return { trump, partnerCards };
  }

  // Lowest card that wins the trick; otherwise the lowest legal card.
  function botPlay(view) {
    const legal = legalCards(view.yourHand, view.trick);
    const low = (c) => (suitOf(c) === view.trump ? 100 : 0) + strength(c) + points(c) / 1000;
    const byLow = (a, b) => low(a) - low(b);
    if (view.trick.length === 0) return legal.slice().sort(byLow)[0];
    const winners = legal.filter(
      (c) => trickWinner([...view.trick, { player: view.you, card: c }], view.trump) === view.you,
    );
    return (winners.length ? winners : legal).slice().sort(byLow)[0];
  }

  const api = { botBid, botDeclare, botPlay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BQ = Object.assign(root.BQ || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
