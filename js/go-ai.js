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
    // Used only in leafScore (searched-line evaluation), not in evaluate()'s
    // per-move ranking: a group at two liberties reads as no more urgent
    // than one sitting comfortably at six, so a large group can be walked
    // down to two liberties over many moves with nothing telling a searched
    // line that it's dangerous, only to find true atari one move too late
    // to escape within the search horizon. This scores that one liberty
    // early at reduced strength, for groups of real size only — a 2-3 stone
    // group at two liberties is ordinary and not worth flagging.
    // (Deliberately not folded into evaluate()/rankMoves — trying that
    // regressed Medium's measured strength on 13x13, because it competes
    // with genuinely better moves for the search's limited top-K candidate
    // slots there; leafScore only judges lines the search already picked.)
    nearAtariFactor: 0.35,
    nearAtariMinSize: 4,
    nearLastMove: 6,      // keep play local rather than scattering
    nearAnyStone: 2,
    starPoint: 8,         // opening: take the big points
    firstLine: -9,        // opening: the edge is small
    secondLine: -2,
    // Kept deliberately small: territory is what decides whether to pass at
    // all (see chooseMove, which uses the raw gain), but leaning on it while
    // ranking moves pulls the AI off tactically better play and measurably
    // narrows its winning margin.
    territory: 0.3,       // per point of territory swing (capped both ways)
    territoryCap: 12,
    jitter: 2,            // so repeat games differ
  };

  const STAR_POINTS = {
    9: [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]],
    13: [[3, 3], [3, 9], [9, 3], [9, 9], [6, 6]],
    19: [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]],
  };

  const MASK = { [BLACK]: 1, [WHITE]: 2 };

  function opponentOf(color) {
    return color === BLACK ? WHITE : BLACK;
  }

  // Neighbour lookup, built once per board size. game.neighbors() allocates an
  // array per call, which is far too much garbage for the per-candidate region
  // scans below.
  let nbCache = { size: 0, table: null, counts: null };
  function neighborTable(size) {
    if (nbCache.size === size) return nbCache;
    const n = size * size;
    const table = new Int16Array(n * 4);
    const counts = new Int8Array(n);
    for (let i = 0; i < n; i++) {
      const r = (i / size) | 0;
      const c = i % size;
      let k = 0;
      if (r > 0) table[i * 4 + k++] = i - size;
      if (r < size - 1) table[i * 4 + k++] = i + size;
      if (c > 0) table[i * 4 + k++] = i - 1;
      if (c < size - 1) table[i * 4 + k++] = i + 1;
      counts[i] = k;
    }
    nbCache = { size, table, counts };
    return nbCache;
  }

  // Flood-fills every empty region, recording its size and which colours touch
  // it. This is the same notion of territory the scoring code uses.
  function computeRegions(board, size) {
    const { table, counts } = neighborTable(size);
    const n = board.length;
    const regionOf = new Int32Array(n).fill(-1);
    const sizes = [];
    const borders = [];
    const stack = [];

    for (let start = 0; start < n; start++) {
      if (board[start] !== EMPTY || regionOf[start] !== -1) continue;
      const id = sizes.length;
      let count = 0;
      let mask = 0;
      stack.length = 0;
      stack.push(start);
      regionOf[start] = id;
      while (stack.length) {
        const cur = stack.pop();
        count++;
        const base = cur * 4;
        for (let j = 0, k = counts[cur]; j < k; j++) {
          const nb = table[base + j];
          const v = board[nb];
          if (v === EMPTY) {
            if (regionOf[nb] === -1) { regionOf[nb] = id; stack.push(nb); }
          } else {
            mask |= MASK[v];
          }
        }
      }
      sizes.push(count);
      borders.push(mask);
    }
    return { regionOf, sizes, borders };
  }

  // Territory owned by `color` minus territory owned by the opponent. Using the
  // difference rather than a bare count keeps early-game moves sensible: a move
  // that merely neutralises the opponent's claim still scores as progress.
  function territoryDiff(regions, color) {
    const mine = MASK[color];
    const theirs = MASK[opponentOf(color)];
    let diff = 0;
    for (let i = 0; i < regions.sizes.length; i++) {
      const mask = regions.borders[i];
      if (mask === mine) diff += regions.sizes[i];
      else if (mask === theirs) diff -= regions.sizes[i];
    }
    return diff;
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

  // Returns null for an illegal/eye-filling point, otherwise the ranking score
  // plus the two facts the pass decision needs: whether the move does anything
  // tactically, and what it is worth in actual territory.
  function evaluate(game, idx, color, ctx) {
    const sim = simulate(game, idx, color);
    if (!sim) return null;
    if (isOwnEye(game, game.board, idx, color)) return null;

    const opp = opponentOf(color);
    let value = 0;
    let tactical = 0;

    tactical += sim.captured * WEIGHTS.capture;

    // Rescuing our own stones: did a group that was on one liberty gain room?
    for (const groupIdx of ctx.ownAtariGroups) {
      if (sim.board[groupIdx] === color) {
        const after = game.getGroup(sim.board, groupIdx);
        if (after.liberties.size > 1) tactical += after.stones.size * WEIGHTS.saveAtari;
      }
    }

    // Pressuring the opponent.
    const checked = new Set();
    for (const n of game.neighbors(idx)) {
      if (sim.board[n] === opp && !checked.has(n)) {
        const group = game.getGroup(sim.board, n);
        for (const s of group.stones) checked.add(s);
        if (group.liberties.size === 1) tactical += group.stones.size * WEIGHTS.giveAtari;
      }
    }

    value += tactical;
    if (sim.liberties === 1 && sim.captured === 0) value += WEIGHTS.selfAtari;
    value += Math.min(sim.liberties, WEIGHTS.libertyCap) * WEIGHTS.liberty;

    // What the move is actually worth on the scoreboard. Captured stones are
    // prisoner points; the rest is the swing in surrounded territory.
    const after = computeRegions(sim.board, game.size);
    let gain = sim.captured + territoryDiff(after, color) - ctx.baseDiff;

    // Landing inside a region enclosed solely by the opponent "destroys" that
    // territory on paper, but this bot cannot read out whether the invading
    // stone lives — crediting it would make the AI spray doomed stones into
    // settled areas and never agree the game is over. Keep only the captures.
    const region = ctx.regions.regionOf[idx];
    if (region >= 0 && ctx.regions.borders[region] === MASK[opp]) {
      gain = sim.captured;
    }

    const capped = Math.max(-WEIGHTS.territoryCap, Math.min(WEIGHTS.territoryCap, gain));
    value += capped * WEIGHTS.territory;

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
    return { value, tactical, gain };
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

    const regions = computeRegions(game.board, game.size);
    return {
      starSet,
      hasStones: stoneCount > 0,
      openingPhase: stoneCount < game.size * game.size * 0.25,
      lastMoveIdx: game.lastMove ? game.index(game.lastMove.row, game.lastMove.col) : -1,
      ownAtariGroups,
      regions,
      baseDiff: territoryDiff(regions, color),
    };
  }

  // Scores every legal, non-eye-filling point and returns them best-first.
  // Shared by the greedy (Easy) picker and the search (Medium) below, so both
  // tiers agree on what a move is worth at a single ply — Medium only differs
  // in how many plies ahead it's willing to look.
  function rankMoves(game, color) {
    const ctx = buildContext(game, color);
    const scored = [];
    for (let idx = 0; idx < game.board.length; idx++) {
      if (game.board[idx] !== EMPTY) continue;
      const result = evaluate(game, idx, color, ctx);
      if (result === null) continue;
      scored.push({ idx, value: result.value, tactical: result.tactical, gain: result.gain });
    }
    scored.sort((a, b) => b.value - a.value);
    return scored;
  }

  // Returns { row, col } to play, or null to pass.
  function chooseMove(game, color) {
    const ranked = rankMoves(game, color);
    if (ranked.length === 0) return null; // nothing legal that isn't our own eye
    const best = ranked[0];

    // The opponent has passed and our best move neither captures anything nor
    // gains a point: agree the game is over rather than filling neutral
    // points. This must stay gated on passCount — a move can easily look
    // "pointless" by this narrow measure (no capture, no territory swing)
    // while the game is still very much live, e.g. a liberty-extending move
    // defending a group under attack in contested, not-yet-settled fighting.
    // Passing there instead of playing the AI's own best-ranked move would
    // abandon a real fight rather than end a finished game.
    if (game.passCount >= 1 && best.tactical <= 0 && best.gain <= 0) return null;

    return { row: Math.floor(best.idx / game.size), col: best.idx % game.size };
  }

  // ---------------------------------------------------------------------
  // Medium: shallow minimax with alpha-beta pruning over the same per-move
  // judgment above. Easy is blind to any plan that needs more than one move
  // to pay off (e.g. two stones that only seal territory together); a few
  // plies of real lookahead catches that class of tactic without needing a
  // faster board representation or a worker thread.
  //
  // Candidate count is deliberately tuned DOWN as the board grows, not up:
  // per-node cost already rises with board size (more points to scan per
  // evaluation), and Go tactics are local, so a wider candidate list on a
  // bigger board buys little — it mostly just spends the time budget faster.
  // Depth stays fixed at 3 plies (its move, a reply, its move again) across
  // all sizes, since that's a fixed tactical reach, not a board-size property.
  const MEDIUM_PARAMS = {
    9: { depth: 3, candidates: 13 },
    13: { depth: 3, candidates: 7 },
    19: { depth: 3, candidates: 4 },
  };

  // Value of a position, from `rootColor`'s perspective. Raw computeScore()
  // territory is a late-forming signal — most of the board only resolves to
  // one color's territory once it's nearly sealed off, so within a 3-ply
  // window it is usually identical for every candidate line (no capture, no
  // newly-enclosed region) and tells the search nothing. This combines the
  // signals that DO move within a few plies — captures made, groups put in
  // or pulled out of atari, liberty count — with territory folded in at the
  // same (small, capped) weight used for ranking single moves, so a searched
  // line is judged the same way a candidate move already is.
  function leafScore(game, rootColor) {
    const opp = opponentOf(rootColor);
    let libertyScore = 0;
    let atariScore = 0;
    const seen = new Set();
    for (let i = 0; i < game.board.length; i++) {
      const c = game.board[i];
      if (c === EMPTY || seen.has(i)) continue;
      const group = game.getGroup(game.board, i);
      for (const s of group.stones) seen.add(s);
      const sign = c === rootColor ? 1 : -1;
      libertyScore += sign * Math.min(group.liberties.size, WEIGHTS.libertyCap);
      if (group.liberties.size === 1) {
        atariScore -= sign * group.stones.size;
      } else if (group.liberties.size === 2 && group.stones.size >= WEIGHTS.nearAtariMinSize) {
        atariScore -= sign * group.stones.size * WEIGHTS.nearAtariFactor;
      }
    }

    const captureDiff = game.captures[rootColor] - game.captures[opp];
    const regions = computeRegions(game.board, game.size);
    const territory = territoryDiff(regions, rootColor);
    const cappedTerritory = Math.max(-WEIGHTS.territoryCap, Math.min(WEIGHTS.territoryCap, territory));

    return captureDiff * WEIGHTS.capture
      + atariScore * WEIGHTS.giveAtari
      + libertyScore * WEIGHTS.liberty
      + cappedTerritory * WEIGHTS.territory;
  }

  // Alpha-beta minimax. `game` is mutated and restored via playMove/undo for
  // the real descent (captures, ko, everything the engine already gets
  // right); rankMoves' own lightweight simulate() stays cheap for the
  // candidate-generation pass at each node. Nodes where it's rootColor's turn
  // maximize; the opponent's nodes minimize.
  function searchValue(game, color, rootColor, depth, alpha, beta, K) {
    if (depth === 0) return leafScore(game, rootColor);

    const ranked = rankMoves(game, color);
    if (ranked.length === 0) return leafScore(game, rootColor); // nothing to do but stop here

    const maximizing = color === rootColor;
    const opp = opponentOf(color);
    let value = maximizing ? -Infinity : Infinity;

    for (let i = 0; i < ranked.length && i < K; i++) {
      const idx = ranked[i].idx;
      const res = game.playMove(Math.floor(idx / game.size), idx % game.size);
      if (!res.legal) continue; // rankMoves already checked; defensive only
      const childValue = searchValue(game, opp, rootColor, depth - 1, alpha, beta, K);
      game.undo();

      if (maximizing) {
        if (childValue > value) value = childValue;
        if (value > alpha) alpha = value;
      } else {
        if (childValue < value) value = childValue;
        if (value < beta) beta = value;
      }
      if (alpha >= beta) break; // the other side already has a better option elsewhere
    }
    return value;
  }

  // Returns { row, col } to play, or null to pass.
  function chooseMediumMove(game, color) {
    const params = MEDIUM_PARAMS[game.size] || MEDIUM_PARAMS[9];
    const ranked = rankMoves(game, color);
    if (ranked.length === 0) return null;

    // Whether to pass is a judgment about whether the position is actually
    // settled, not about how deep to search — reuse Easy's already-correct
    // signal (does the single best move capture anything or shift real
    // territory right now) rather than comparing searched leaf scores. Those
    // are legitimately near-identical across candidates this early — no
    // territory has enclosed yet within just a few plies of an empty-ish
    // board — which made the search mistake "too early to tell" for
    // "nothing left to gain" and pass out live games.
    if (game.passCount >= 1 && ranked[0].tactical <= 0 && ranked[0].gain <= 0) return null;

    const opp = opponentOf(color);
    let bestIdx = null;
    let bestValue = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;

    for (let i = 0; i < ranked.length && i < params.candidates; i++) {
      const idx = ranked[i].idx;
      const res = game.playMove(Math.floor(idx / game.size), idx % game.size);
      if (!res.legal) continue;
      const value = searchValue(game, opp, color, params.depth - 1, alpha, beta, params.candidates);
      game.undo();

      if (value > bestValue) { bestValue = value; bestIdx = idx; }
      if (value > alpha) alpha = value;
    }

    if (bestIdx === null) return null;
    return { row: Math.floor(bestIdx / game.size), col: bestIdx % game.size };
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

  return { chooseMove, chooseMediumMove, handicapPoints, isOwnEye };
})();

if (typeof window !== 'undefined') window.GoAI = GoAI;
