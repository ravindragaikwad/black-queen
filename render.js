'use strict';
// Pure HTML-string renderers. No DOM access; app.js puts the result in the page and handles clicks
// through the data-action attributes.
(function (root) {
  const bq = typeof require === 'function' ? require('./blackqueen') : root.BQ;
  const sbm = typeof require === 'function' ? require('./scoreboard') : root.BQ;
  const { cardSvg } = typeof require === 'function' ? require('./cards') : root.BQ;
  const { fullDeck, legalCards, minBid, partnerCount, rankOf, suitOf, strength, SUITS, MAX_BID, BID_STEP } = bq;

  const SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const HAND_SUIT_ORDER = ['S', 'H', 'C', 'D'];
  const MAX_PER_ROW = 5;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const label = (card) => rankOf(card) + SYMBOL[suitOf(card)];
  const colour = (card) => (suitOf(card) === 'H' || suitOf(card) === 'D' ? 'red' : 'black');
  const signed = (n) => (n > 0 ? `+${n}` : String(n));
  const staticCard = (card) => `<span class="card mini ${colour(card)}">${cardSvg(card)}</span>`;

  function renderHand(hand, { legal, selected, partnerCards, enabled }) {
    const sorted = hand.slice().sort(
      (a, b) => HAND_SUIT_ORDER.indexOf(suitOf(a)) - HAND_SUIT_ORDER.indexOf(suitOf(b)) || strength(b) - strength(a),
    );
    const rowCount = Math.max(1, Math.ceil(sorted.length / MAX_PER_ROW));
    const perRow = Math.ceil(sorted.length / rowCount);
    const rows = [];
    for (let i = 0; i < sorted.length; i += perRow) rows.push(sorted.slice(i, i + perRow));
    const cardHtml = (card) => {
      const isSelected = enabled && selected === card && legal.includes(card);
      const classes = ['card', colour(card)];
      if (isSelected) classes.push('selected');
      if (partnerCards.includes(card)) classes.push('partner-card');
      const attrs = `data-card="${card}"`;
      if (!enabled || !legal.includes(card)) {
        return `<button class="${classes.join(' ')}" ${attrs} aria-disabled="true" tabindex="-1">${cardSvg(card)}</button>`;
      }
      const action = isSelected ? 'play' : 'select';
      return `<button class="${classes.join(' ')}" ${attrs} data-action="${action}">${cardSvg(card)}</button>`;
    };
    const rowsHtml = rows.map((row) => `<div class="hand-row">${row.map(cardHtml).join('')}</div>`).join('');
    return `<div class="hand${enabled ? '' : ' locked'}">${rowsHtml}</div>`;
  }

  // Percent position of a seat on the oval table: seat 0 at the bottom centre, others clockwise.
  // `factor` < 1 pulls the point toward the centre (used for cards played in front of a seat).
  function seatPosition(i, n, factor = 1) {
    const angle = ((90 + (i * 360) / n) * Math.PI) / 180;
    const round = (v) => Math.round(v * 10) / 10;
    return { left: round(50 + 40 * factor * Math.cos(angle)), top: round(50 + 38 * factor * Math.sin(angle)) };
  }

  function seatTile(i, ctx) {
    const { view, bids } = ctx.state;
    const classes = ['seat'];
    if (view.turn === i && view.phase !== 'done') classes.push('turn');
    if (i === view.you) classes.push('you');
    let sub;
    if (view.phase === 'bidding') {
      const b = bids[i];
      sub = b === null ? '—' : b === 'pass' ? 'pass' : String(b);
    } else {
      sub = `${view.captured[i]} pts`;
    }
    let badges = '';
    if (view.bidder === i) badges += '<span class="badge badge-bidder">bidder</span>';
    if (view.revealedPartners.includes(i)) badges += '<span class="badge badge-partner">partner</span>';
    const pos = seatPosition(i, ctx.names.length);
    const initial = esc(String(ctx.names[i]).charAt(0).toUpperCase());
    return `<div class="${classes.join(' ')}" data-seat="${i}" style="left:${pos.left}%;top:${pos.top}%">` +
      `<span class="avatar" style="--hue:${i * 40}">${initial}</span><span class="name">${esc(ctx.names[i])}</span>${badges}<em>${esc(sub)}</em></div>`;
  }

  // The round table: felt, every seat around it, a centre label, and any played cards in front of their players.
  function tableHtml(ctx, centre, playedHtml = '') {
    const tiles = ctx.names.map((_, i) => seatTile(i, ctx)).join('');
    return `<div class="table"><div class="felt"></div>${tiles}<div class="table-center">${centre}</div>${playedHtml}</div>`;
  }

  function handFor(ctx, enabled) {
    const { view } = ctx.state;
    const legal = enabled ? legalCards(view.yourHand, view.trick) : view.yourHand;
    return renderHand(view.yourHand, {
      legal, selected: ctx.selected, partnerCards: view.partnerCards, enabled,
    });
  }

  function renderBidding(ctx) {
    const { view, userTurn, bids } = ctx.state;
    const floor = view.highBid === null ? minBid(view.n) : view.highBid + BID_STEP;
    let controls = '';
    if (userTurn) {
      const amount = Math.min(MAX_BID, Math.max(ctx.bidAmount || 0, floor));
      controls = '<div class="bid-controls">';
      if (floor <= MAX_BID) {
        controls +=
          `<button class="btn ghost" data-action="bid-step" data-delta="-5">−5</button>` +
          `<span class="bid-amount">${amount}</span>` +
          `<button class="btn ghost" data-action="bid-step" data-delta="5">+5</button>` +
          `<button class="btn" data-action="bid">Bid ${amount}</button>`;
      }
      controls += '<button class="btn ghost" data-action="pass">Pass</button></div>';
    } else if (bids[view.you] === 'pass') {
      controls = '<p class="note">You passed.</p>';
    }
    const current = view.highBid === null ? 'No bid yet' : `Current bid: ${view.highBid} by ${esc(ctx.names[view.highBidder])}`;
    return `<section class="screen bidding"><h2>Bidding</h2>${tableHtml(ctx, `<span class="bid-chip">${current}</span>`)}${handFor(ctx, false)}${controls}</section>`;
  }

  function renderDeclare(ctx) {
    const { view, userTurn } = ctx.state;
    const bidderName = esc(ctx.names[view.bidder]);
    if (!(userTurn && view.bidder === view.you)) {
      return `<section class="screen declare"><h2>${bidderName} won the bid at ${view.bid}</h2>${tableHtml(ctx, `<span class="bid-chip">Choosing trump…</span>`)}${handFor(ctx, false)}</section>`;
    }
    const count = partnerCount(view.n);
    const inPlay = fullDeck().filter((c) => !view.removed.includes(c));
    const trumpButtons = SUITS.map(
      (s) => `<button class="pill${ctx.trump === s ? ' on' : ''}" data-action="pick-trump" data-suit="${s}">${SYMBOL[s]}</button>`,
    ).join('');
    const rows = HAND_SUIT_ORDER.map((s) => {
      const cards = inPlay.filter((c) => suitOf(c) === s).sort((a, b) => strength(b) - strength(a));
      const buttons = cards.map((c) => {
        const own = view.yourHand.includes(c) ? ' own' : '';
        return `<button class="pill ${colour(c)}${ctx.partnerPicks.includes(c) ? ' on' : ''}${own}" data-action="pick-partner" data-card="${c}">${label(c)}</button>`;
      }).join('');
      return `<div class="pick-row">${buttons}</div>`;
    }).join('');
    const ready = ctx.trump && ctx.partnerPicks.length === count;
    const confirm = ready ? '<button class="btn" data-action="declare">Confirm</button>' : '';
    return `<section class="screen declare"><h2>You won at ${view.bid}</h2><p>Pick trump</p><div class="row">${trumpButtons}</div>` +
      `<p>Name ${count} partner card${count > 1 ? 's' : ''}</p>${rows}${handFor(ctx, false)}<div class="row">${confirm}</div></section>`;
  }

  function renderPlay(ctx) {
    const { view, userTurn, paused, completedTrick } = ctx.state;
    const shown = completedTrick ? completedTrick.cards : view.trick;
    const playedHtml = shown.map((t) => {
      const win = completedTrick && completedTrick.winner === t.player ? ' winner' : '';
      const pos = seatPosition(t.player, ctx.names.length, 0.45);
      return `<div class="trick-card${win}" style="left:${pos.left}%;top:${pos.top}%">${staticCard(t.card)}</div>`;
    }).join('');
    const caption = completedTrick
      ? `<p class="note">${esc(ctx.names[completedTrick.winner])} wins the trick (+${completedTrick.points})</p>`
      : '';
    let status = '';
    if (userTurn) status = 'Your turn';
    else if (!paused && view.phase === 'play') status = `Waiting for ${esc(ctx.names[view.turn])}`;
    const selectedOk = ctx.selected && userTurn && legalCards(view.yourHand, view.trick).includes(ctx.selected);
    const playButton = selectedOk
      ? `<button class="btn" data-action="play" data-card="${ctx.selected}">Play ${label(ctx.selected)}</button>`
      : '';
    const info =
      `Trump ${SYMBOL[view.trump]} · Bid ${view.bid} by ${esc(ctx.names[view.bidder])} · Partner card${view.partnerCards.length > 1 ? 's' : ''}: ${view.partnerCards.map(staticCard).join(' ')}`;
    const centre = `<span class="bid-chip">Bid ${view.bid}</span><span class="trump-chip ${view.trump === 'H' || view.trump === 'D' ? 'red' : ''}">${SYMBOL[view.trump]}</span>`;
    return `<section class="screen play"><p class="info">${info}</p>${tableHtml(ctx, centre, playedHtml)}${caption}` +
      `<p class="status">${status}</p>${handFor(ctx, userTurn)}<div class="row">${playButton}</div></section>`;
  }

  function renderResult(ctx) {
    const { view } = ctx.state;
    const res = view.result;
    const rowsHtml = ctx.names.map((name, i) =>
      `<tr><td>${esc(name)}${res.team.includes(i) ? ' (team)' : ''}</td><td>${signed(res.scores[i])}</td><td>${signed(ctx.scoreboard.totals[i])}</td></tr>`,
    ).join('');
    const team = res.team.map((i) => esc(ctx.names[i])).join(', ');
    return `<section class="screen result"><h2>Bid ${res.success ? 'made' : 'missed'}</h2>` +
      `<p>${esc(ctx.names[view.bidder])} bid ${res.bid}. Team (${team}) scored ${res.teamPoints}.</p>` +
      `<table><tr><th>Player</th><th>This round</th><th>Total</th></tr>${rowsHtml}</table>` +
      `<div class="row"><button class="btn" data-action="next-round">Deal next round</button><button class="btn ghost" data-action="stop">Stop</button></div></section>`;
  }

  function renderSetup(ctx) {
    const { n, savedMismatch } = ctx.setup;
    const counts = [5, 6, 7, 8, 9].map(
      (k) => `<button class="pill${k === n ? ' on' : ''}" data-action="set-players" data-n="${k}">${k}</button>`,
    ).join('');
    const seatRows = sbm.botNames(n).map((name, i) => `<tr><td>${i + 1}. ${esc(name)}</td><td>${i === 0 ? 'Human' : 'Bot'}</td></tr>`).join('');
    const board = ctx.scoreboard;
    let boardHtml = '';
    if (board.rounds > 0 && board.names.length === n) {
      const rows = board.names.map((name, i) => `<tr><td>${esc(name)}</td><td>${signed(board.totals[i])}</td></tr>`).join('');
      const rounds = `${board.rounds} round${board.rounds === 1 ? '' : 's'}`;
      const reset = ctx.setup.confirmScoreboardReset
        ? `<p class="note">Erase the scoreboard (${rounds})? This cannot be undone.</p>` +
          '<div class="row"><button class="btn" data-action="confirm-scoreboard-reset">Erase</button>' +
          '<button class="btn ghost" data-action="cancel-scoreboard-reset">Cancel</button></div>'
        : '<div class="row"><button class="btn ghost" data-action="reset-scoreboard">Reset scoreboard</button></div>';
      boardHtml = `<h3>Scoreboard (${rounds})</h3><table>${rows}</table>${reset}`;
    }
    const action = savedMismatch
      ? `<p class="note">Your saved scoreboard is for ${board.names.length} players. Reset it to play with ${n}?</p>` +
        '<div class="row"><button class="btn" data-action="confirm-reset">Reset and start</button><button class="btn ghost" data-action="cancel-reset">Cancel</button></div>'
      : '<div class="row"><button class="btn" data-action="start">Start game</button></div>';
    return `<section class="screen setup"><h1>Black Queen</h1><p><b>Players</b></p><div class="row">${counts}</div>` +
      `<table>${seatRows}</table><p class="note">Minimum bid ${minBid(n)}, ${partnerCount(n)} partner card${partnerCount(n) > 1 ? 's' : ''}.</p>${action}${boardHtml}</section>`;
  }

  function renderScreen(ctx) {
    if (ctx.screen === 'setup') return renderSetup(ctx);
    if (ctx.screen === 'result') return renderResult(ctx);
    const phase = ctx.state.view.phase;
    if (phase === 'bidding') return renderBidding(ctx);
    if (phase === 'declare') return renderDeclare(ctx);
    return renderPlay(ctx);
  }

  const api = { renderHand, renderScreen, seatPosition };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BQ = Object.assign(root.BQ || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
