'use strict';
// Running totals per seat, saved on the device. Storage is injected (localStorage in the browser).
(function (root) {
  const KEY = 'blackqueen.scoreboard.v1';
  const LEVEL_KEY = 'blackqueen.level.v1';
  const LEVELS = ['easy', 'smart'];
  const BOT_NAMES = ['Asha', 'Dev', 'Mira', 'Kabir', 'Zoya', 'Rohan', 'Priya', 'Sam'];

  const botNames = (n) => ['You', ...BOT_NAMES].slice(0, n);

  const newScoreboard = (n) => ({ names: botNames(n), totals: Array(n).fill(0), rounds: 0 });

  const applyRound = (sb, scores) => ({
    names: sb.names.slice(),
    totals: sb.totals.map((t, i) => t + scores[i]),
    rounds: sb.rounds + 1,
  });

  const isValid = (sb) =>
    !!sb &&
    typeof sb === 'object' &&
    Array.isArray(sb.names) &&
    sb.names.every((s) => typeof s === 'string') &&
    Array.isArray(sb.totals) &&
    sb.totals.length === sb.names.length &&
    sb.totals.every((t) => Number.isFinite(t)) &&
    Number.isInteger(sb.rounds) &&
    sb.rounds >= 0;

  function saveScoreboard(storage, sb) {
    try {
      storage.setItem(KEY, JSON.stringify(sb));
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadScoreboard(storage) {
    try {
      const raw = storage.getItem(KEY);
      if (raw === null || raw === undefined) return null;
      const sb = JSON.parse(raw);
      return isValid(sb) ? sb : null;
    } catch (e) {
      return null;
    }
  }

  function clearScoreboard(storage) {
    try {
      storage.removeItem(KEY);
    } catch (e) {
      // storage unavailable: nothing to clear
    }
  }

  // Which bots to play against; remembered on the device. Defaults to the smart bots.
  function loadLevel(storage) {
    try {
      const v = storage.getItem(LEVEL_KEY);
      return LEVELS.includes(v) ? v : 'smart';
    } catch (e) {
      return 'smart';
    }
  }

  function saveLevel(storage, level) {
    if (!LEVELS.includes(level)) return false;
    try {
      storage.setItem(LEVEL_KEY, level);
      return true;
    } catch (e) {
      return false;
    }
  }

  const api = { loadLevel, saveLevel, botNames, newScoreboard, applyRound, saveScoreboard, loadScoreboard, clearScoreboard };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BQ = Object.assign(root.BQ || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
