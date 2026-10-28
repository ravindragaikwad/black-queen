'use strict';
// Smarter bot. Like every bot it sees only Game.viewFor(seat): its own hand plus what is public
// (tricks played so far, the trump, the named partner cards, who has revealed themselves).
// It counts cards, notices who has run out of a suit, works out which side it is on, and plays each
// card for the best expected number of points for its side.
(function (root) {
  const bq = typeof require === 'function' ? require('./blackqueen') : root.BQ;
  const { SUITS, MAX_BID, BID_STEP, points, suitOf, rankOf, strength, fullDeck, partnerCount, minBid, legalCards, trickWinner } = bq;

  const DEFAULT_PARAMS = {
    // bidding: shave `margin` points off the estimate, stretch its spread by `sigmaScale`, and only bid for `minEv` or more
    margin: { default: 0, 9: 8 }, sigmaScale: 1, minEv: { default: 10, 5: -10, 6: -10 },
    // play
    feedAlive: 0.65, trumpLead: 4,
  };

  const HONOUR = { A: 6, K: 4.5, Q: 3.5, J: 2.5, 10: 2, 9: 1.5, 8: 1 };

  const cardsOfSuit = (hand, s) => hand.filter((c) => suitOf(c) === s);
  const handPoints = (hand) => hand.reduce((sum, c) => sum + points(c), 0);

  // How strong a suit is as trump: honours plus length.
  function trumpPower(hand, suit) {
    const cards = cardsOfSuit(hand, suit);
    const honours = cards.reduce((sum, c) => sum + (HONOUR[rankOf(c)] || 0), 0);
    return honours + 2.5 * Math.max(0, cards.length - 3);
  }

  function bestTrump(hand) {
    return SUITS.map((s) => ({ s, power: trumpPower(hand, s), len: cardsOfSuit(hand, s).length }))
      .sort((a, b) => b.power - a.power || b.len - a.len)[0];
  }

  // ---- what the bot knows ----

  const inPlay = (view) => fullDeck().filter((c) => !view.removed.includes(c));

  function unseenCards(view) {
    const seen = new Set(view.yourHand);
    for (const t of view.history) for (const c of t.cards) seen.add(c.card);
    for (const c of view.trick) seen.add(c.card);
    return inPlay(view).filter((c) => !seen.has(c));
  }

  // Suits each player has shown they have run out of (they played another suit on a lead).
  function voidSuits(view) {
    const voids = Array.from({ length: view.n }, () => new Set());
    const tricks = view.history.map((t) => t.cards).concat([view.trick]);
    for (const cards of tricks) {
      if (!cards.length) continue;
      const led = suitOf(cards[0].card);
      for (const { player, card } of cards) if (suitOf(card) !== led) voids[player].add(led);
    }
    return voids;
  }

  function roleOf(view) {
    if (view.bidder === view.you) return 'bidder';
    if (view.revealedPartners.includes(view.you)) return 'partner';
    if (view.partnerCards.some((c) => view.yourHand.includes(c))) return 'partner';
    return 'opponent';
  }

  // +1 for a seat on my side, -1 for the other. Unknown seats count against a team player (they are
  // probably opponents) and for an opponent (only a few seats are partners).
  function sideOf(view) {
    const role = roleOf(view);
    const team = new Set([view.bidder, ...view.revealedPartners]);
    if (role === 'opponent') return (seat) => (team.has(seat) ? -1 : 1);
    team.add(view.you);
    return (seat) => (team.has(seat) ? 1 : -1);
  }

  // Chance that `winCard` is still winning after the players in `remaining` have played.
  function survival(winCard, led, remaining, k) {
    const { unseen, voids, view } = k;
    const U = unseen.length || 1;
    const trump = view.trump;
    const ledCount = unseen.filter((c) => suitOf(c) === led).length;
    const trumps = unseen.filter((c) => suitOf(c) === trump);
    const winIsTrump = suitOf(winCard) === trump;
    const higherTrumps = winIsTrump ? trumps.filter((c) => strength(c) > strength(winCard)).length : 0;
    const higherLed = winIsTrump ? 0 : unseen.filter((c) => suitOf(c) === led && strength(c) > strength(winCard)).length;
    let alive = 1;
    for (const p of remaining) {
      const h = view.handSizes[p];
      const holds = (n) => 1 - Math.pow(Math.max(0, (U - n) / U), h);
      const isVoid = voids[p].has(led);
      let beat;
      if (led === trump) {
        beat = isVoid ? 0 : holds(higherTrumps);
      } else if (winIsTrump) {
        beat = (isVoid ? 1 : Math.pow(Math.max(0, (U - ledCount) / U), h)) * holds(higherTrumps);
      } else {
        const viaLed = isVoid ? 0 : holds(higherLed);
        const viaTrump = (isVoid ? 1 : Math.pow(Math.max(0, (U - ledCount) / U), h)) * holds(trumps.length);
        beat = 1 - (1 - viaLed) * (1 - viaTrump);
      }
      alive *= 1 - beat;
    }
    return alive;
  }

  // Measured by simulation (12,000 random deals per table size, every seat playing this bot, 125 points in the game):
  // team points ~ w0 + w1*handPoints + w2*trumpPower + w3*sideAces, with spread sigma.
  const CALIBRATION = {
    5: { w: [47.469, 0.125, 1.672, 7.823], sigma: 23.3 },
    6: { w: [44.404, 0.075, 2.154, 6.984], sigma: 24.5 },
    7: { w: [68.46, 0.046, 1.796, 3.241], sigma: 25.2 },
    8: { w: [69.259, 0.052, 1.585, 1.971], sigma: 26.4 },
    9: { w: [84.128, 0.027, 0.997, 0.777], sigma: 25.9 },
  };


  // Standard normal cumulative distribution (Abramowitz and Stegun 7.1.26).
  function normalCdf(z) {
    const x = Math.abs(z) / Math.SQRT2;
    const t = 1 / (1 + 0.3275911 * x);
    const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
  }

  // A setting can be one number or a table of numbers by player count, with a `default`.
  const forTable = (setting, n) => (typeof setting === 'object' ? (n in setting ? setting[n] : setting.default) : setting);

  function createBots(params = DEFAULT_PARAMS) {
    const P = { ...DEFAULT_PARAMS, ...params };

    // The score for a made bid is the bid itself, so bid whatever amount maximises the expected score:
    // amount * (2 * P(team makes it) - 1). A strong hand jumps straight to a high bid.
    function botBid(view) {
      const hand = view.yourHand;
      const best = bestTrump(hand);
      const sideAces = hand.filter((c) => rankOf(c) === 'A' && suitOf(c) !== best.s).length;
      const cal = CALIBRATION[view.n];
      const mean = cal.w[0] + cal.w[1] * handPoints(hand) + cal.w[2] * best.power + cal.w[3] * sideAces - forTable(P.margin, view.n);
      const sigma = cal.sigma * P.sigmaScale;
      const floor = view.highBid === null ? minBid(view.n) : view.highBid + BID_STEP;
      let pick = null;
      for (let amount = floor; amount <= MAX_BID; amount += BID_STEP) {
        const made = 1 - normalCdf((amount - mean) / sigma);
        const ev = amount * (2 * made - 1);
        if (pick === null || ev > pick.ev) pick = { amount, ev };
      }
      return pick && pick.ev > forTable(P.minEv, view.n) ? { action: 'bid', amount: pick.amount } : { action: 'pass' };
    }

    // Trump is the strongest suit; ask for the cards that win tricks and that the bot does not hold.
    function botDeclare(view) {
      const hand = view.yourHand;
      const trump = bestTrump(hand).s;
      const value = (c) => {
        const r = rankOf(c);
        if (suitOf(c) === trump) return { A: 10, K: 8, Q: 6, J: 3, 10: 2 }[r] || 0;
        if (c === 'QS') return 5;
        return { A: 7, K: 3, Q: 1 }[r] || 0;
      };
      const partnerCards = inPlay(view)
        .filter((c) => !hand.includes(c))
        .sort((a, b) => value(b) - value(a) || strength(b) - strength(a) || SUITS.indexOf(suitOf(a)) - SUITS.indexOf(suitOf(b)))
        .slice(0, partnerCount(view.n));
      return { trump, partnerCards };
    }

    // Ordering for "cheapest": plain cards before trumps, then by rank.
    const cheapness = (view) => (c) => (suitOf(c) === view.trump ? 100 : 0) + strength(c);
    const cheapest = (view, cards) => cards.slice().sort((a, b) => cheapness(view)(a) - cheapness(view)(b))[0];

    // Highest card of a plain suit that nobody can beat (all higher cards of that suit have been played).
    function masterLead(view, unseen) {
      const masters = view.yourHand.filter(
        (c) => suitOf(c) !== view.trump && !unseen.some((u) => suitOf(u) === suitOf(c) && strength(u) > strength(c)),
      );
      return masters.length ? masters.sort((a, b) => strength(b) - strength(a))[0] : null;
    }

    function botPlay(view) {
      const legal = legalCards(view.yourHand, view.trick);
      if (legal.length === 1) return legal[0];
      const me = view.you;
      const n = view.n;
      const unseen = unseenCards(view);
      const role = roleOf(view);

      if (view.trick.length === 0) {
        const master = masterLead(view, unseen);
        if (master) return master; // a sure winner: cash it
        if (role !== 'opponent') {
          // draw the opponents' trumps out when holding a few good ones
          const trumps = view.yourHand.filter((c) => suitOf(c) === view.trump).sort((a, b) => strength(b) - strength(a));
          if (trumps.length >= P.trumpLead) return trumps[0];
        }
        return cheapest(view, legal);
      }

      const side = sideOf(view);
      const current = trickWinner(view.trick, view.trump);
      const winners = legal.filter((c) => trickWinner(view.trick.concat([{ player: me, card: c }]), view.trump) === me);

      // A teammate is winning and is likely to keep winning: give them points without wasting a trump or an overtake.
      const remaining = [];
      for (let i = 1; i <= n - view.trick.length - 1; i++) remaining.push((me + i) % n);
      const winCard = view.trick.find((t) => t.player === current).card;
      const alive = remaining.length
        ? survival(winCard, suitOf(view.trick[0].card), remaining, { unseen, voids: voidSuits(view), view })
        : 1;
      if (current !== me && side(current) === 1 && alive >= P.feedAlive) {
        const plain = legal.filter((c) => suitOf(c) !== view.trump);
        const pool = plain.length ? plain : legal;
        const notWinning = pool.filter((c) => !winners.includes(c));
        return (notWinning.length ? notWinning : pool)
          .slice()
          .sort((a, b) => points(b) - points(a) || cheapness(view)(a) - cheapness(view)(b))[0];
      }
      if (winners.length) return cheapest(view, winners); // take the trick as cheaply as possible
      // cannot win: throw away something worthless rather than a point card
      const worthless = legal.filter((c) => points(c) === 0);
      return cheapest(view, worthless.length ? worthless : legal);
    }

    return { botBid, botDeclare, botPlay };
  }

  const smartBots = createBots();

  // Medium: bids like the easy bot, but names smart partner cards and plays sensibly (cashes sure winners,
  // takes tricks cheaply, never throws points to opponents). It does not coordinate with teammates: no feeding
  // points to a winning partner and no drawing trumps, which is what the smart bot adds.
  const easyBots = typeof require === 'function' ? require('./bot') : root.BQ;
  const uncoordinated = createBots({ feedAlive: 2, trumpLead: 99 });
  const mediumBots = { botBid: easyBots.botBid, botDeclare: smartBots.botDeclare, botPlay: uncoordinated.botPlay };

  const api = { smartBots, mediumBots, createBots, DEFAULT_PARAMS, helpers: { unseenCards, voidSuits, roleOf, sideOf, survival, trumpPower, bestTrump, handPoints } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BQ = Object.assign(root.BQ || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
