'use strict';
// DOM wiring: one click listener dispatching on data-action, state kept in ctx, HTML from render.js.
(function (root) {
  const { Session, renderScreen, botNames, newScoreboard, applyRound, saveScoreboard, loadScoreboard, clearScoreboard, loadLevel, saveLevel, smartBots,
    minBid, partnerCount, MAX_BID, BID_STEP, cues, createFx, createSound } = root.BQ;

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

  const sound = createSound({ storage, AudioCtx: root.AudioContext || root.webkitAudioContext });
  const reducedMotion = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const fx = createFx({ gsap: root.gsap, confetti: root.confetti, reducedMotion });

  let session = null;
  let recorded = false;
  let prevState = null; // last state shown, to work out which sounds and animations to run
  let flyFrom = null; // where the user's card was before it was played
  const ctx = {
    screen: 'setup', names: botNames(startN), state: null, selected: null, bidAmount: 0,
    trump: null, partnerPicks: [], setup: { n: startN, savedMismatch: false }, scoreboard: board,
    muted: sound.isMuted(), level: loadLevel(storage),
  };

  const draw = () => { el.innerHTML = renderScreen(ctx); };

  function nextBidFloor() {
    const v = ctx.state.view;
    return v.highBid === null ? minBid(v.n) : v.highBid + BID_STEP;
  }

  const rectOfSeat = (p) => {
    const seat = el.querySelector(`[data-seat="${p}"] .avatar`);
    return seat ? seat.getBoundingClientRect() : null;
  };

  // Sounds and animations for a change of state. `before` lists whose cards were already on the table.
  function runCues(list, before) {
    list.forEach((c) => {
      if (c === 'sweep') root.setTimeout(() => sound.play('sweep'), 700);
      else sound.play(c);
    });
    if (list.includes('deal')) {
      const table = el.querySelector('.table');
      const r = table ? table.getBoundingClientRect() : { left: root.innerWidth / 2, top: root.innerHeight / 2, width: 0, height: 0 };
      fx.deal([...el.querySelectorAll('.hand .card')], { left: r.left + r.width / 2, top: r.top + r.height / 2, width: 0, height: 0 });
    }
    if (list.includes('play')) {
      el.querySelectorAll('.trick-card').forEach((card) => {
        if (before.has(card.dataset.player)) return;
        const p = Number(card.dataset.player);
        const from = p === 0 && flyFrom ? flyFrom : rectOfSeat(p);
        if (from) fx.fly(card, from);
      });
      flyFrom = null;
    }
    if (list.includes('sweep')) {
      const winner = rectOfSeat(ctx.state.completedTrick.winner);
      if (winner) fx.sweep([...el.querySelectorAll('.trick-card')], winner);
    }
    if (list.includes('win')) fx.celebrate();
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
      ctx.screen = 'review'; // stay on the table first; the result is one tap away
    } else if (ctx.screen !== 'result' && ctx.screen !== 'review') {
      ctx.screen = 'game';
    }
    const before = new Set([...el.querySelectorAll('.trick-card')].map((n) => n.dataset.player));
    draw();
    runCues(cues(prevState, state), before);
    prevState = state;
  }

  function begin(n) {
    ctx.names = botNames(n);
    ctx.selected = null;
    ctx.trump = null;
    ctx.partnerPicks = [];
    ctx.bidAmount = 0;
    recorded = false;
    prevState = null;
    flyFrom = null;
    ctx.screen = 'game';
    session = new Session({ n, onChange: onSessionChange, bots: ctx.level === 'smart' ? smartBots : undefined });
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
    select(d) { ctx.selected = d.card; sound.play('select'); draw(); },
    play(d) {
      const cardEl = el.querySelector(`.card[data-card="${d.card}"]`);
      flyFrom = cardEl ? cardEl.getBoundingClientRect() : null;
      ctx.selected = null;
      session.userPlay(d.card);
    },
    'set-level'(d) { ctx.level = d.level; saveLevel(storage, d.level); draw(); },
    'toggle-sound'() { ctx.muted = sound.toggle(); draw(); },
    'show-result'() { ctx.screen = 'result'; draw(); },
    'view-table'() { ctx.screen = 'review'; draw(); },
    'next-round'() { begin(session.game.n); },
    stop() { ctx.setup.n = session.game.n; ctx.setup.savedMismatch = false; ctx.screen = 'setup'; draw(); },
  };

  el.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target || !actions[target.dataset.action]) return;
    sound.unlock(); // browsers only allow audio after a tap
    try {
      actions[target.dataset.action](target.dataset);
    } catch (err) {
      flyFrom = null;
      console.warn(err.message); // an out-of-turn tap is refused by the engine; the screen stays as it was
    }
  });

  draw();
})(globalThis);
