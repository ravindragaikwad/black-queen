'use strict';
// DOM wiring: one click listener dispatching on data-action, state kept in ctx, HTML from render.js.
(function (root) {
  const { Session, renderScreen, botNames, newScoreboard, applyRound, saveScoreboard, loadScoreboard, clearScoreboard,
    minBid, partnerCount, MAX_BID, BID_STEP } = root.BQ;

  function deviceStorage() {
    try {
      return root.localStorage;
    } catch (e) {
      return { getItem: () => null, setItem() { throw new Error('unavailable'); }, removeItem() {} };
    }
  }

  const storage = deviceStorage();
  const el = root.document.getElementById('app');

  let board = loadScoreboard(storage);
  const startN = board && board.names.length >= 5 && board.names.length <= 9 ? board.names.length : 6;
  if (!board) board = newScoreboard(startN);

  let session = null;
  let recorded = false;
  const ctx = {
    screen: 'setup', names: botNames(startN), state: null, selected: null, bidAmount: 0,
    trump: null, partnerPicks: [], setup: { n: startN, savedMismatch: false }, scoreboard: board,
  };

  const draw = () => { el.innerHTML = renderScreen(ctx); };

  function nextBidFloor() {
    const v = ctx.state.view;
    return v.highBid === null ? minBid(v.n) : v.highBid + BID_STEP;
  }

  function onSessionChange(state) {
    ctx.state = state;
    if (!state.userTurn) ctx.selected = null;
    if (state.view.phase === 'done' && !state.paused) {
      if (!recorded) {
        recorded = true;
        board = applyRound(board, state.view.result.scores);
        saveScoreboard(storage, board);
        ctx.scoreboard = board;
      }
      ctx.screen = 'result';
    } else if (ctx.screen !== 'result') {
      ctx.screen = 'game';
    }
    draw();
  }

  function begin(n) {
    ctx.names = botNames(n);
    ctx.selected = null;
    ctx.trump = null;
    ctx.partnerPicks = [];
    ctx.bidAmount = 0;
    recorded = false;
    ctx.screen = 'game';
    session = new Session({ n, onChange: onSessionChange });
    session.start();
  }

  function resetBoard(n) {
    board = newScoreboard(n);
    ctx.scoreboard = board;
    saveScoreboard(storage, board);
  }

  const actions = {
    'set-players': (d) => { ctx.setup.n = Number(d.n); ctx.setup.savedMismatch = false; ctx.setup.confirmScoreboardReset = false; draw(); },
    start() {
      const n = ctx.setup.n;
      ctx.setup.confirmScoreboardReset = false;
      if (board.names.length !== n) {
        if (board.rounds > 0) { ctx.setup.savedMismatch = true; draw(); return; }
        resetBoard(n);
      }
      begin(n);
    },
    'confirm-reset'() { ctx.setup.savedMismatch = false; resetBoard(ctx.setup.n); begin(ctx.setup.n); },
    'cancel-reset'() { ctx.setup.savedMismatch = false; ctx.setup.n = board.names.length; draw(); },
    'reset-scoreboard'() { ctx.setup.confirmScoreboardReset = true; draw(); },
    'cancel-scoreboard-reset'() { ctx.setup.confirmScoreboardReset = false; draw(); },
    'confirm-scoreboard-reset'() {
      ctx.setup.confirmScoreboardReset = false;
      clearScoreboard(storage);
      resetBoard(ctx.setup.n);
      draw();
    },
    'bid-step'(d) {
      const floor = nextBidFloor();
      ctx.bidAmount = Math.min(MAX_BID, Math.max(floor, (ctx.bidAmount || floor) + Number(d.delta)));
      draw();
    },
    bid() { session.userBid(Math.min(MAX_BID, Math.max(nextBidFloor(), ctx.bidAmount || 0))); },
    pass() { session.userPass(); },
    'pick-trump'(d) { ctx.trump = d.suit; draw(); },
    'pick-partner'(d) {
      const count = partnerCount(ctx.state.view.n);
      const at = ctx.partnerPicks.indexOf(d.card);
      if (at >= 0) ctx.partnerPicks.splice(at, 1);
      else if (ctx.partnerPicks.length < count) ctx.partnerPicks.push(d.card);
      else if (count === 1) ctx.partnerPicks = [d.card];
      draw();
    },
    declare() { session.userDeclare(ctx.trump, ctx.partnerPicks.slice()); },
    select(d) { ctx.selected = d.card; draw(); },
    play(d) { ctx.selected = null; session.userPlay(d.card); },
    'next-round'() { begin(session.game.n); },
    stop() { ctx.setup.n = session.game.n; ctx.setup.savedMismatch = false; ctx.screen = 'setup'; draw(); },
  };

  el.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target || !actions[target.dataset.action]) return;
    try {
      actions[target.dataset.action](target.dataset);
    } catch (err) {
      console.warn(err.message); // an out-of-turn tap is refused by the engine; the screen stays as it was
    }
  });

  draw();
})(globalThis);
