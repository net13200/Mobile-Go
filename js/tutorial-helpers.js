// Predicate helpers for lesson checkSuccess() bodies. Built only on public
// GoGame methods so lessons stay declarative one-liners. Kept in its own
// file (no DOM access) so the whole curriculum can be verified in Node.

const TutorialHelpers = {
  // The stone the learner just placed.
  playedAt(game, row, col) {
    return !!game.lastMove && game.lastMove.row === row && game.lastMove.col === col;
  },

  playedAnyOf(game, points) {
    return points.some((p) => TutorialHelpers.playedAt(game, p.row, p.col));
  },

  groupLiberties(game, row, col) {
    const idx = game.index(row, col);
    if (game.board[idx] === EMPTY) return 0;
    return game.getGroup(game.board, idx).liberties.size;
  },

  capturedAt(game, row, col) {
    return game.board[game.index(row, col)] === EMPTY;
  },

  // Enclosed empty regions surrounded entirely by this one group. A region of
  // any size counts as a single eye space, which is what "two eyes = alive"
  // needs. Does not attempt false-eye detection.
  countEyes(game, row, col) {
    const idx = game.index(row, col);
    if (game.board[idx] === EMPTY) return 0;
    const group = game.getGroup(game.board, idx);
    const visited = new Set();
    let eyes = 0;
    for (const libIdx of group.liberties) {
      if (visited.has(libIdx)) continue;
      const region = [libIdx];
      visited.add(libIdx);
      let enclosed = true;
      let qi = 0;
      while (qi < region.length) {
        const cur = region[qi++];
        for (const n of game.neighbors(cur)) {
          if (game.board[n] === EMPTY) {
            if (!visited.has(n)) { visited.add(n); region.push(n); }
          } else if (!group.stones.has(n)) {
            enclosed = false;
          }
        }
      }
      if (enclosed) eyes++;
    }
    return eyes;
  },

  // Would a stone of `color` played at this empty point be immediately in
  // atari? Used for tiger's-mouth style shape checks.
  wouldBeAtari(game, row, col, color) {
    const idx = game.index(row, col);
    if (game.board[idx] !== EMPTY) return false;
    const test = [...game.board];
    test[idx] = color;
    return game.getGroup(test, idx).liberties.size === 1;
  },

  // After Black's atari, does White's forced extension still leave exactly
  // two liberties (ladder keeps working) rather than breaking out?
  ladderContinues(game, row, col) {
    const idx = game.index(row, col);
    if (game.board[idx] === EMPTY) return false;
    const group = game.getGroup(game.board, idx);
    if (group.liberties.size !== 1) return false;
    const [libIdx] = [...group.liberties];
    const testBoard = [...game.board];
    testBoard[libIdx] = game.board[idx];
    return game.getGroup(testBoard, libIdx).liberties.size === 2;
  },
};

if (typeof window !== 'undefined') window.TutorialHelpers = TutorialHelpers;
