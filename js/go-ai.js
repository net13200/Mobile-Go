// Heuristic computer opponent. Pure functions over a GoGame — evaluates every
// legal point once and picks the best, so it answers instantly at any board
// size and needs no worker thread.
//
// Strength is roughly that of a casual beginner: it reliably takes captures,
// saves its own stones from atari, avoids self-atari, and never fills its own
// eyes, but it does not read sequences ahead.

const GoAI = (function () {
  'use strict';

  const WEIGHTS = {
    capture: 18,          // per opponent stone taken
    saveAtari: 14,        // per own stone rescued from atari
    giveAtari: 6,         // per opponent stone put in atari
    selfAtari: -30,       // leaving the new group on one liberty
    liberty: 1.5,         // per liberty of the resulting group (capped)
    libertyCap: 6,
    nearLastMove: 6,      // keep play local rather than scattering
    nearAnyStone: 2,
    starPoint: 8,         // opening: take the big points
    firstLine: -9,        // opening: the edge is small
    secondLine: -2,
    jitter: 2,            // so repeat games differ
  };

  const STAR_POINTS = {
    9: [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]],
    13: [[3, 3], [3, 9], [9, 3], [9, 9], [6, 6]],
    19: [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]],
  };

  function opponentOf(color) {
    return color === BLACK ? WHITE : BLACK;
  }

  // Diagonal neighbours, which decide whether a surrounded point is a real eye.
  function diagonals(game, idx) {
    const size = game.size;
    const r = Math.floor(idx / size);
    const c = idx % size;
    const out = [];
    for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) out.push(nr * size + nc);
    }
    return out;
  }

  // A point the AI must never fill: orthogonally enclosed by its own stones,
  // with enough friendly diagonals that it is a genuine eye rather than a
  // false one. Filling these is how naive bots kill their own groups.
  function isOwnEye(game, board, idx, color) {
    for (const n of game.neighbors(idx)) {
      if (board[n] !== color) return false;
    }
    const diags = diagonals(game, idx);
    let friendly = 0;
    let hostile = 0;
    for (const d of diags) {
      if (board[d] === color) friendly++;
      else if (board[d] === opponentOf(color)) hostile++;
    }
    // On the edge/corner every available diagonal must be friendly; in the
    // middle one hostile diagonal is still an eye.
    return diags.length < 4 ? hostile === 0 : hostile <= 1 && friendly >= 2;
  }

  // Apply a move to a copied board without touching game state.
  // Returns null when the move is illegal.
  function simulate(game, idx, color) {
    if (game.board[idx] !== EMPTY) return null;
    const opp = opponentOf(color);
    const board = [...game.board];
    board[idx] = color;

    let captured = 0;
    const seen = new Set();
    for (const n of game.neighbors(idx)) {
      if (board[n] === opp && !seen.has(n)) {
        const group = game.getGroup(board, n);
        for (const s of group.stones) seen.add(s);
        if (group.liberties.size === 0) {
          for (const s of group.stones) {
            board[s] = EMPTY;
            captured++;
          }
        }
      }
    }

    const mine = game.getGroup(board, idx);
    if (mine.liberties.size === 0) return null; // suicide

    // Respect the same positional-superko history the real engine enforces,
    // so the move we recommend won't be rejected when it is actually played.
    if (game.positionHistory.has(game._historyKey(board, opp))) return null;

    return { board, captured, liberties: mine.liberties.size, groupSize: mine.stones.size };
  }

  function score(game, idx, color, ctx) {
    const sim = simulate(game, idx, color);
    if (!sim) return null;
    if (isOwnEye(game, game.board, idx, color)) return null;

    const opp = opponentOf(color);
    let value = 0;

    value += sim.captured * WEIGHTS.capture;

    // Rescuing our own stones: did a group that was on one liberty gain room?
    for (const groupIdx of ctx.ownAtariGroups) {
      if (sim.board[groupIdx] === color) {
        const after = game.getGroup(sim.board, groupIdx);
        if (after.liberties.size > 1) value += after.stones.size * WEIGHTS.saveAtari;
      }
    }

    // Pressuring the opponent.
    const checked = new Set();
    for (const n of game.neighbors(idx)) {
      if (sim.board[n] === opp && !checked.has(n)) {
        const group = game.getGroup(sim.board, n);
        for (const s of group.stones) checked.add(s);
        if (group.liberties.size === 1) value += group.stones.size * WEIGHTS.giveAtari;
      }
    }

    if (sim.liberties === 1 && sim.captured === 0) value += WEIGHTS.selfAtari;
    value += Math.min(sim.liberties, WEIGHTS.libertyCap) * WEIGHTS.liberty;

    // Locality: answer where the action is.
    if (ctx.lastMoveIdx >= 0) {
      const d = distance(game, idx, ctx.lastMoveIdx);
      if (d <= 2) value += WEIGHTS.nearLastMove;
      else if (d <= 3) value += WEIGHTS.nearLastMove / 2;
    }
    if (ctx.hasStones) {
      for (const n of game.neighbors(idx)) {
        if (game.board[n] !== EMPTY) { value += WEIGHTS.nearAnyStone; break; }
      }
    }

    // Opening shape: big points are worth more than the edge early on.
    if (ctx.openingPhase) {
      const size = game.size;
      const r = Math.floor(idx / size);
      const c = idx % size;
      const edge = Math.min(r, c, size - 1 - r, size - 1 - c);
      if (edge === 0) value += WEIGHTS.firstLine;
      else if (edge === 1) value += WEIGHTS.secondLine;
      if (ctx.starSet.has(idx)) value += WEIGHTS.starPoint;
    }

    value += Math.random() * WEIGHTS.jitter;
    return value;
  }

  function distance(game, a, b) {
    const size = game.size;
    return Math.abs(Math.floor(a / size) - Math.floor(b / size)) + Math.abs((a % size) - (b % size));
  }

  function buildContext(game, color) {
    const stars = STAR_POINTS[game.size] || [];
    const starSet = new Set(stars.map(([r, c]) => r * game.size + c));

    let stoneCount = 0;
    for (let i = 0; i < game.board.length; i++) if (game.board[i] !== EMPTY) stoneCount++;

    // One representative stone per own group that is currently in atari.
    const ownAtariGroups = [];
    const seen = new Set();
    for (let i = 0; i < game.board.length; i++) {
      if (game.board[i] === color && !seen.has(i)) {
        const group = game.getGroup(game.board, i);
        for (const s of group.stones) seen.add(s);
        if (group.liberties.size === 1) ownAtariGroups.push(i);
      }
    }

    return {
      starSet,
      hasStones: stoneCount > 0,
      openingPhase: stoneCount < game.size * game.size * 0.25,
      lastMoveIdx: game.lastMove ? game.index(game.lastMove.row, game.lastMove.col) : -1,
      ownAtariGroups,
    };
  }

  // Returns { row, col } to play, or null to pass.
  function chooseMove(game, color) {
    const ctx = buildContext(game, color);
    let best = null;
    let bestValue = -Infinity;

    for (let idx = 0; idx < game.board.length; idx++) {
      if (game.board[idx] !== EMPTY) continue;
      const value = score(game, idx, color, ctx);
      if (value === null) continue;
      if (value > bestValue) {
        bestValue = value;
        best = idx;
      }
    }

    if (best === null) return null; // nothing legal that isn't our own eye

    // If the opponent has already passed, only keep playing for a move that
    // actually does something — otherwise agree the game is over.
    if (game.passCount >= 1 && bestValue < 5) return null;

    return { row: Math.floor(best / game.size), col: best % game.size };
  }

  // Traditional handicap placement, in the conventional order.
  function handicapPoints(size, count) {
    const s = size;
    const near = s === 9 ? 2 : 3;
    const far = s - 1 - near;
    const mid = (s - 1) / 2;
    if (!Number.isInteger(mid) || count < 2) return [];

    const TL = [near, near], TR = [near, far], BL = [far, near], BR = [far, far];
    const T = [near, mid], B = [far, mid], L = [mid, near], R = [mid, far];
    const C = [mid, mid];

    const layouts = {
      2: [TR, BL],
      3: [TR, BL, BR],
      4: [TR, BL, BR, TL],
      5: [TR, BL, BR, TL, C],
      6: [TR, BL, BR, TL, L, R],
      7: [TR, BL, BR, TL, L, R, C],
      8: [TR, BL, BR, TL, L, R, T, B],
      9: [TR, BL, BR, TL, L, R, T, B, C],
    };
    const pts = layouts[Math.min(count, 9)] || [];
    return pts.map(([row, col]) => ({ row, col, color: BLACK }));
  }

  return { chooseMove, handicapPoints, isOwnEye };
})();

if (typeof window !== 'undefined') window.GoAI = GoAI;
