'use strict';
// Running totals per seat, saved on the device. Storage is injected (localStorage in the browser).
(function (root) {
  const KEY = 'blackqueen.scoreboard.v1';
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

  const api = { botNames, newScoreboard, applyRound, saveScoreboard, loadScoreboard, clearScoreboard };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BQ = Object.assign(root.BQ || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
