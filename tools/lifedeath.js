// Exhaustive local life-and-death solver, exported for reuse across the
// test tools. Answers one precise question: is this White group
// unconditionally alive — does it survive even if Black gets to attack it
// first — using the real engine for every candidate move (captures, suicide,
// and ko all enforced for real, not approximated).
//
// This exists because "the board currently looks settled" is not the same
// claim as "this group cannot be captured." A shape can sit on the board
// looking exactly like a textbook-alive corner while actually being one
// move short of real life — see the 13x13 example game's original corner,
// a thin L-shaped chain that looked like the standard "rectangular six" eye
// space but wasn't a solid enough enclosure to be automatically alive.
// Nothing about the current board state distinguishes that case from a
// genuinely alive one without reading it out.
//
// Two pitfalls worth naming, since both produced silently wrong answers
// during development before being caught:
//   1. A group's own `liberties` set is not necessarily its whole eye space
//      — a thin, bent group can enclose a point it doesn't directly touch,
//      reachable only through another empty point first. Always flood-fill
//      the full connected empty region from a liberty, not just the
//      liberties themselves.
//   2. game.playMove() plays whatever color game.currentPlayer actually is,
//      completely ignoring any separately-tracked "whose turn" variable of
//      your own. Driving the recursion from anything other than
//      game.currentPlayer silently tests the wrong side's moves the moment
//      your own bookkeeping and the engine's real turn order disagree.

function connectedEmptyRegion(game, EMPTY, startIdx) {
  const region = new Set([startIdx]);
  const stack = [startIdx];
  while (stack.length) {
    const cur = stack.pop();
    for (const n of game.neighbors(cur)) {
      if (game.board[n] === EMPTY && !region.has(n)) { region.add(n); stack.push(n); }
    }
  }
  return region;
}

// boardArray/size/komi describe the position; seedRow/seedCol is any point
// of the White group to test. BLACK/WHITE/EMPTY are the engine's color
// constants (passed in rather than imported, since callers load GoGame
// differently — a vm sandbox global in the test tools, a real module
// elsewhere). Returns { alive, nodes, aborted }. `aborted` is true if the
// search exceeded maxNodes without resolving — a large open eye space can
// have a genuinely huge tree; treat an aborted result as "unknown", not as
// a pass, since it just means the search wasn't decisive rather than that
// the group was cleared.
function groupIsUnconditionallyAlive(GoGameCtor, BLACK, WHITE, EMPTY, size, boardArray, seedRow, seedCol, komi, maxNodes = 200000) {
  const stones = [];
  for (let idx = 0; idx < boardArray.length; idx++) {
    if (boardArray[idx] !== EMPTY) stones.push({ row: Math.floor(idx / size), col: idx % size, color: boardArray[idx] });
  }
  // Rebuild via loadPosition with Black explicitly to move: the standard
  // "unconditionally alive" question is "does it survive even if the
  // attacker moves first", independent of whatever the real recorded
  // game's move-count parity happens to make the actual next player.
  const game = new GoGameCtor(size, komi);
  game.loadPosition(stones, BLACK);

  const seedIdx = game.index(seedRow, seedCol);
  if (game.board[seedIdx] !== WHITE) {
    throw new Error(`groupIsUnconditionallyAlive: seed (${seedRow},${seedCol}) is not a White stone`);
  }

  const group = game.getGroup(game.board, seedIdx);
  const region = connectedEmptyRegion(game, EMPTY, [...group.liberties][0]);

  function groupAlive() { return game.board[seedIdx] === WHITE; }
  const memo = new Map();
  function key() { return game.board.join('') + '|' + game.currentPlayer; }

  let nodes = 0;
  let aborted = false;

  function solve(depth) {
    if (aborted) return false;
    if (!groupAlive()) return true;
    if (++nodes > maxNodes) { aborted = true; return false; }
    if (depth > 40) return false; // safety valve; real eye spaces here are small
    const k = key();
    if (memo.has(k)) return memo.get(k);
    const mover = game.currentPlayer;
    const candidates = [...region].filter((idx) => game.board[idx] === EMPTY);
    let result;
    if (mover === BLACK) {
      // Black (the attacker) succeeds if ANY legal move leads to an
      // eventual forced capture.
      result = false;
      for (const idx of candidates) {
        const res = game.playMove(Math.floor(idx / size), idx % size);
        if (!res.legal) continue;
        const sub = solve(depth + 1);
        game.undo();
        if (sub) { result = true; break; }
      }
    } else {
      // White (the defender) survives if ANY legal move leads to Black no
      // longer being able to force a capture afterward.
      result = true;
      for (const idx of candidates) {
        const res = game.playMove(Math.floor(idx / size), idx % size);
        if (!res.legal) continue;
        const sub = solve(depth + 1);
        game.undo();
        if (!sub) { result = false; break; }
      }
      if (candidates.length === 0) result = false; // no legal reply; group stands as-is only if already safe (handled by groupAlive() above)
    }
    memo.set(k, result);
    return result;
  }

  const blackForcesCapture = solve(0);
  return { alive: !blackForcesCapture && !aborted, nodes, aborted, regionSize: region.size };
}

module.exports = { groupIsUnconditionallyAlive, connectedEmptyRegion };
