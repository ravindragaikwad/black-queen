'use strict';
// Drives one round: the user is seat 0, bots play the other seats on timers.
(function (root) {
  const bq = typeof require === 'function' ? require('./blackqueen') : root.BQ;
  const defaultBots = typeof require === 'function' ? require('./bot') : root.BQ;
  const { Game } = bq;
  const USER = 0;

  class Session {
    constructor({
      n,
      rng = Math.random,
      schedule = (fn, ms) => setTimeout(fn, ms),
      onChange = () => {},
      bots = defaultBots,
      botDelay = 700,
      trickPause = 1500,
    }) {
      this.game = new Game(n, { rng });
      this.schedule = schedule;
      this.onChange = onChange;
      this.bots = bots;
      this.botDelay = botDelay;
      this.trickPause = trickPause;
      this.bids = Array(n).fill(null);
      this.completedTrick = null;
      this.paused = false;
      this.botPending = false;
    }

    start() {
      this._advance();
    }

    state() {
      const g = this.game;
      return {
        view: g.viewFor(USER),
        userTurn: !this.paused && g.phase !== 'done' && g.turn === USER,
        paused: this.paused,
        completedTrick: this.completedTrick,
        bids: this.bids.slice(),
      };
    }

    userBid(amount) {
      this._guard();
      this.game.placeBid(USER, amount);
      this.bids[USER] = amount;
      this._advance();
    }

    userPass() {
      this._guard();
      this.game.pass(USER);
      this.bids[USER] = 'pass';
      this._advance();
    }

    userDeclare(trump, partnerCards) {
      this._guard();
      this.game.declare(USER, trump, partnerCards);
      this._advance();
    }

    userPlay(card) {
      this._guard();
      this._play(USER, card);
    }

    _guard() {
      if (this.paused) throw new Error('Wait for the trick to finish');
      if (this.game.phase === 'done' || this.game.turn !== USER) throw new Error('Not your turn');
    }

    _play(seat, card) {
      const before = this.game.lastTrick;
      this.game.play(seat, card);
      if (this.game.lastTrick !== before) {
        this.completedTrick = this.game.lastTrick;
        this.paused = true;
        this.onChange(this.state());
        this.schedule(() => {
          this.paused = false;
          this.completedTrick = null;
          this._advance();
        }, this.trickPause);
        return;
      }
      this._advance();
    }

    _advance() {
      this.onChange(this.state());
      const g = this.game;
      if (g.phase === 'done' || this.paused || g.turn === USER || this.botPending) return;
      this.botPending = true;
      this.schedule(() => this._botMove(), this.botDelay);
    }

    _botMove() {
      this.botPending = false;
      const g = this.game;
      const seat = g.turn;
      const view = g.viewFor(seat); // bots only ever see their own view
      if (g.phase === 'bidding') {
        const r = this.bots.botBid(view);
        if (r.action === 'bid') {
          g.placeBid(seat, r.amount);
          this.bids[seat] = r.amount;
        } else {
          g.pass(seat);
          this.bids[seat] = 'pass';
        }
        this._advance();
      } else if (g.phase === 'declare') {
        const d = this.bots.botDeclare(view);
        g.declare(seat, d.trump, d.partnerCards);
        this._advance();
      } else {
        this._play(seat, this.bots.botPlay(view));
      }
    }
  }

  Session.USER = USER;
  const api = { Session };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BQ = Object.assign(root.BQ || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
