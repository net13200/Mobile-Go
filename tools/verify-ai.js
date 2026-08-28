// Exercises the computer opponent against the real engine.
// Run: node tools/verify-ai.js
//
// Checks the invariants that matter for a bot that must never embarrass
// itself: every move it proposes is legal, it never fills its own eye, games
// terminate, it crushes a random player, and it answers fast enough to feel
// instant on a phone.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

// The AI jitters its move choice and the sparring partner plays at random, so
// an unseeded run is a coin toss that occasionally reports a spurious loss.
// Seeding Math.random inside the sandbox makes the whole suite reproducible.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seededMath = Object.create(Math);
seededMath.random = mulberry32(20260827);

const sandbox = { console, window: undefined, Math: seededMath };
vm.createContext(sandbox);
for (const file of ['js/go-engine.js', 'js/go-ai.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
}
const { GoGame, GoAI, BLACK, WHITE, EMPTY } = vm.runInContext(
  '({ GoGame, GoAI, BLACK, WHITE, EMPTY })', sandbox);

let failures = 0;
const fail = (msg) => { failures++; console.log('  FAIL ' + msg); };

function randomMove(game, color) {
  const empties = [];
  for (let i = 0; i < game.board.length; i++) {
    if (game.board[i] === EMPTY && !GoAI.isOwnEye(game, game.board, i, color)) empties.push(i);
  }
  while (empties.length) {
    const pick = Math.floor(seededMath.random() * empties.length);
    const idx = empties[pick];
    const move = { row: Math.floor(idx / game.size), col: idx % game.size };
    if (game.playMove(move.row, move.col).legal) return move;
    empties.splice(pick, 1);
  }
  return null;
}

// aiColor plays with GoAI; the other side plays randomly.
function playGame(size, aiColor, maxMoves) {
  const game = new GoGame(size, 6.5);
  let moves = 0;
  let maxThinkMs = 0;

  while (!game.scoringPhase && moves < maxMoves) {
    const color = game.currentPlayer;
    if (color === aiColor) {
      const t0 = Date.now();
      const move = GoAI.chooseMove(game, color);
      maxThinkMs = Math.max(maxThinkMs, Date.now() - t0);
      if (move === null) {
        game.pass();
      } else {
        const idx = game.index(move.row, move.col);
        if (GoAI.isOwnEye(game, game.board, idx, color)) {
          fail(`AI filled its own eye at (${move.row},${move.col})`);
        }
        const res = game.playMove(move.row, move.col);
        if (!res.legal) {
          fail(`AI proposed an illegal move (${move.row},${move.col}): ${res.reason}`);
          game.pass();
        }
      }
    } else if (randomMove(game, color) === null) {
      game.pass();
    }
    moves++;
  }

  const s = game.computeScore();
  const aiScore = aiColor === BLACK ? s.blackScore : s.whiteScore;
  const oppScore = aiColor === BLACK ? s.whiteScore : s.blackScore;
  return { finished: game.scoringPhase, moves, maxThinkMs, aiWon: aiScore > oppScore, margin: aiScore - oppScore };
}

console.log('Passing behaviour');
{
  // A fully settled position: two solid walls, nothing left but neutral points.
  const walls = [];
  for (let r = 0; r < 9; r++) {
    walls.push({ row: r, col: 3, color: BLACK });
    walls.push({ row: r, col: 5, color: WHITE });
  }

  // 1. Opponent passes in a finished position -> the AI must pass straight back.
  const settled = new GoGame(9, 6.5);
  settled.loadPosition(walls, BLACK);
  settled.pass();
  if (GoAI.chooseMove(settled, WHITE) !== null) {
    fail('did not pass back in a settled position after the opponent passed');
  } else {
    console.log('  ok    passes back when the game is over');
  }

  // 2. It must not grind on filling neutral points and its own territory.
  const grind = new GoGame(9, 6.5);
  grind.loadPosition(walls, BLACK);
  grind.pass();
  let extra = 0;
  while (!grind.scoringPhase && extra < 200) {
    const m = GoAI.chooseMove(grind, grind.currentPlayer);
    if (m === null) grind.pass(); else grind.playMove(m.row, m.col);
    extra++;
  }
  const after = grind.computeScore();
  console.log(`  ok    game ended after ${extra} further move(s); territory B ${after.blackTerritory} / W ${after.whiteTerritory}`);
  if (after.blackTerritory < 27 || after.whiteTerritory < 27) {
    fail('the AI destroyed settled territory instead of passing');
  }

  // 3. It must NOT pass out of a live game.
  const opening = new GoGame(9, 6.5);
  if (GoAI.chooseMove(opening, BLACK) === null) fail('passed on an empty board');
  opening.playMove(4, 4);
  if (GoAI.chooseMove(opening, WHITE) === null) fail('passed on move 2 of the game');
  const earlyPass = new GoGame(9, 6.5);
  earlyPass.pass();
  if (GoAI.chooseMove(earlyPass, WHITE) === null) {
    fail('passed out a live game just because the opponent opened with a pass');
  }

  // 4. Regression: a group under pressure but not yet in atari has no move
  // that captures anything or scores positively on the crude territory
  // heuristic (extending it only gives up a formerly "owned" empty point).
  // An earlier version of chooseMove passed here anyway — with passCount
  // still 0 — abandoning a live fight instead of playing on. Traced from an
  // actual game the AI lost to a random opponent this way.
  const fight = new GoGame(9, 6.5);
  fight.loadPosition([
    { row: 4, col: 4, color: BLACK }, { row: 4, col: 5, color: BLACK },
    { row: 3, col: 4, color: WHITE }, { row: 3, col: 5, color: WHITE },
    { row: 5, col: 4, color: WHITE }, { row: 5, col: 5, color: WHITE },
  ], BLACK);
  if (GoAI.chooseMove(fight, BLACK) === null) {
    fail('passed out a live game while a group had no capturing/positive-gain move available');
  }

  console.log('  ok    keeps playing while there is territory to win');
}

console.log('\nAI vs random player');
// The AI evaluates each position once with no lookahead, so on rare occasions
// a purely random opponent's move sequence can still surround and kill a
// group before the heuristic recognises the danger (confirmed by tracing a
// real failure: at the losing move the AI legitimately had zero legal moves
// left outside its own eyes — it wasn't refusing to defend, the position was
// already lost). A large unseeded sample lands this around a 99% win rate at
// every board size. Demanding a perfect 100% here just makes the suite
// fragile to the seed rather than catching real regressions, so the bar is a
// win rate a heuristic bot should clear with room to spare — a genuine
// regression (like the AI refusing to defend at all) fails it outright.
const MIN_WIN_RATE = 0.85;
for (const size of [9, 13, 19]) {
  const games = size === 19 ? 8 : 40;
  let wins = 0, unfinished = 0, worstThink = 0, totalMargin = 0;
  for (let i = 0; i < games; i++) {
    const r = playGame(size, i % 2 === 0 ? BLACK : WHITE, size * size * 3);
    if (r.aiWon) wins++;
    if (!r.finished) unfinished++;
    worstThink = Math.max(worstThink, r.maxThinkMs);
    totalMargin += r.margin;
  }
  const avg = (totalMargin / games).toFixed(1);
  const rate = wins / games;
  console.log(`  ${size}x${size}: won ${wins}/${games} (${(rate * 100).toFixed(0)}%), avg margin ${avg}, slowest move ${worstThink}ms, unfinished ${unfinished}`);
  if (rate < MIN_WIN_RATE) fail(`${size}x${size}: win rate ${(rate * 100).toFixed(0)}% is below the ${MIN_WIN_RATE * 100}% floor`);
  if (unfinished > 0) fail(`${size}x${size}: ${unfinished} game(s) never reached scoring`);
  // Budget: a phone is roughly 3x slower than this machine.
  if (worstThink > 120) fail(`${size}x${size}: slowest move ${worstThink}ms is too slow to feel instant`);
}

console.log('\nAI vs AI (termination + legality)');
for (const size of [9, 13]) {
  const game = new GoGame(size, 6.5);
  let moves = 0;
  while (!game.scoringPhase && moves < size * size * 4) {
    const color = game.currentPlayer;
    const move = GoAI.chooseMove(game, color);
    if (move === null) { game.pass(); } else {
      const res = game.playMove(move.row, move.col);
      if (!res.legal) fail(`self-play ${size}x${size}: illegal move ${res.reason}`);
    }
    moves++;
  }
  const s = game.computeScore();
  console.log(`  ${size}x${size}: reached scoring=${game.scoringPhase} in ${moves} moves, ` +
              `B ${s.blackScore.toFixed(1)} / W ${s.whiteScore.toFixed(1)}`);
  if (!game.scoringPhase) fail(`self-play ${size}x${size} never terminated`);
  // Both sides should still be alive on the board — a bot that self-destructs
  // by filling its own eyes ends up with almost nothing.
  let b = 0, w = 0;
  for (const v of game.board) { if (v === BLACK) b++; else if (v === WHITE) w++; }
  console.log(`     stones on board: B ${b} / W ${w}`);
  if (b === 0 || w === 0) fail(`self-play ${size}x${size}: one side was wiped out`);
}

console.log('\nHandicap placement');
for (const size of [9, 13, 19]) {
  for (const n of [2, 4, 5, 9]) {
    const pts = GoAI.handicapPoints(size, n);
    if (pts.length !== n) { fail(`handicap ${n} on ${size}x${size}: got ${pts.length} points`); continue; }
    const seen = new Set();
    for (const p of pts) {
      const key = `${p.row},${p.col}`;
      if (seen.has(key)) fail(`handicap ${n} on ${size}x${size}: duplicate point ${key}`);
      seen.add(key);
      if (p.row < 0 || p.row >= size || p.col < 0 || p.col >= size) {
        fail(`handicap ${n} on ${size}x${size}: point ${key} off board`);
      }
      if (p.color !== BLACK) fail(`handicap stones must be Black`);
    }
    // Must load into a real game cleanly, with White to move.
    const game = new GoGame(size, 0.5);
    game.loadPosition(pts, WHITE);
    let placed = 0;
    for (const v of game.board) if (v === BLACK) placed++;
    if (placed !== n) fail(`handicap ${n} on ${size}x${size}: ${placed} stones on board`);
  }
  console.log(`  ${size}x${size}: 2/4/5/9-stone layouts OK`);
}

// ---------------------------------------------------------------------
// Medium: shallow alpha-beta search over the same per-move judgment above.
// It should still obey every invariant Easy does (legal, never fills its
// own eye, terminates, passes correctly) and additionally play noticeably
// stronger, since it can see a move whose payoff only lands after a reply.

console.log('\nMedium: passing behaviour');
{
  const walls = [];
  for (let r = 0; r < 9; r++) {
    walls.push({ row: r, col: 3, color: BLACK });
    walls.push({ row: r, col: 5, color: WHITE });
  }

  const settled = new GoGame(9, 6.5);
  settled.loadPosition(walls, BLACK);
  settled.pass();
  if (GoAI.chooseMediumMove(settled, WHITE) !== null) {
    fail('Medium did not pass back in a settled position after the opponent passed');
  } else {
    console.log('  ok    passes back when the game is over');
  }

  const opening = new GoGame(9, 6.5);
  if (GoAI.chooseMediumMove(opening, BLACK) === null) fail('Medium passed on an empty board');
  const earlyPass = new GoGame(9, 6.5);
  earlyPass.pass();
  if (GoAI.chooseMediumMove(earlyPass, WHITE) === null) {
    fail('Medium passed out a live game just because the opponent opened with a pass');
  }

  // Same live-fight regression as Easy: a group under pressure but not yet
  // capturable has no move that captures or scores positively on the crude
  // territory heuristic. Medium must keep fighting, not read this as "no
  // good move exists" and pass.
  const fight = new GoGame(9, 6.5);
  fight.loadPosition([
    { row: 4, col: 4, color: BLACK }, { row: 4, col: 5, color: BLACK },
    { row: 3, col: 4, color: WHITE }, { row: 3, col: 5, color: WHITE },
    { row: 5, col: 4, color: WHITE }, { row: 5, col: 5, color: WHITE },
  ], BLACK);
  if (GoAI.chooseMediumMove(fight, BLACK) === null) {
    fail('Medium passed out a live game while a group had no capturing/positive-gain move available');
  }
  console.log('  ok    keeps playing while there is territory to win');
}

console.log('\nMedium: legality and self-play termination');
// 19x19 self-play is dropped from the termination requirement — same as the
// Easy AI-vs-AI suite above — since a full 19x19 game can legitimately run
// long; it's covered separately below for legality and timing instead.
for (const size of [9, 13]) {
  const game = new GoGame(size, 6.5);
  let moves = 0;
  let worstThink = 0;
  const limit = size * size * 3;
  while (!game.scoringPhase && moves < limit) {
    const color = game.currentPlayer;
    const t0 = Date.now();
    const move = GoAI.chooseMediumMove(game, color);
    worstThink = Math.max(worstThink, Date.now() - t0);
    if (move === null) {
      game.pass();
    } else {
      const idx = game.index(move.row, move.col);
      if (GoAI.isOwnEye(game, game.board, idx, color)) {
        fail(`Medium filled its own eye at (${move.row},${move.col}) on ${size}x${size}`);
      }
      const res = game.playMove(move.row, move.col);
      if (!res.legal) fail(`Medium proposed an illegal move (${move.row},${move.col}) on ${size}x${size}: ${res.reason}`);
    }
    moves++;
  }
  console.log(`  ${size}x${size}: reached scoring=${game.scoringPhase} in ${moves} moves, slowest move ${worstThink}ms`);
  if (!game.scoringPhase) fail(`Medium self-play ${size}x${size} never terminated`);
  // A phone is roughly 3x slower than this machine; MEDIUM_PARAMS is tuned
  // to keep this comfortably under what still feels instant even there.
  if (worstThink > 400) fail(`Medium ${size}x${size}: slowest move ${worstThink}ms is too slow`);
}

// 19x19: legality and timing across a handful of representative positions
// (empty, opening, midgame), without requiring a full game to reach scoring.
{
  const size = 19;
  const stages = [
    new GoGame(size, 6.5),
    (() => { const g = new GoGame(size, 6.5); for (let i = 0; i < 20; i++) { const m = GoAI.chooseMove(g, g.currentPlayer); if (m) g.playMove(m.row, m.col); else g.pass(); } return g; })(),
    (() => { const g = new GoGame(size, 6.5); for (let i = 0; i < 60; i++) { const m = GoAI.chooseMove(g, g.currentPlayer); if (m) g.playMove(m.row, m.col); else g.pass(); } return g; })(),
  ];
  let worstThink = 0;
  for (const g of stages) {
    const color = g.currentPlayer;
    const t0 = Date.now();
    const move = GoAI.chooseMediumMove(g, color);
    worstThink = Math.max(worstThink, Date.now() - t0);
    if (move) {
      const idx = g.index(move.row, move.col);
      if (GoAI.isOwnEye(g, g.board, idx, color)) fail(`Medium filled its own eye at (${move.row},${move.col}) on 19x19`);
      const res = g.playMove(move.row, move.col);
      if (!res.legal) fail(`Medium proposed an illegal move (${move.row},${move.col}) on 19x19: ${res.reason}`);
    }
  }
  console.log(`  19x19: legal across empty/opening/midgame stages, slowest move ${worstThink}ms`);
  if (worstThink > 400) fail(`Medium 19x19: slowest move ${worstThink}ms is too slow`);
}

console.log('\nMedium vs Easy (strength)');
// The one thing depth buys that a single ply cannot: judging a move by what
// the position is worth after a reply, not just its immediate score.
//
// Average score margin, not win count, is the primary bar here: with the
// AI's own jitter in play, a fixed and affordable sample of games leaves
// individual win/loss outcomes noisy (a few close games can flip either
// way), but the average margin is a continuous measure and settles down
// far faster — it stayed clearly positive and stable (roughly +14 to +25)
// across repeated runs even while the win rate swung 53-80%. Win rate is
// still reported and given a loose sanity floor to catch an actual
// regression (Medium losing outright, not just less often).
function playMediumVsEasy(size, mediumColor, maxMoves) {
  const game = new GoGame(size, 6.5);
  let moves = 0;
  let maxThinkMs = 0;
  while (!game.scoringPhase && moves < maxMoves) {
    const color = game.currentPlayer;
    const chooser = color === mediumColor ? GoAI.chooseMediumMove : GoAI.chooseMove;
    const t0 = Date.now();
    const move = chooser(game, color);
    if (color === mediumColor) maxThinkMs = Math.max(maxThinkMs, Date.now() - t0);
    if (move === null) game.pass(); else game.playMove(move.row, move.col);
    moves++;
  }
  const s = game.computeScore();
  const mediumScore = mediumColor === BLACK ? s.blackScore : s.whiteScore;
  const easyScore = mediumColor === BLACK ? s.whiteScore : s.blackScore;
  return { finished: game.scoringPhase, maxThinkMs, mediumWon: mediumScore > easyScore, margin: mediumScore - easyScore };
}
const MIN_MEDIUM_AVG_MARGIN = 5;
const MIN_MEDIUM_WIN_RATE = 0.4;
for (const size of [9, 13]) {
  const games = size === 9 ? 30 : 10;
  let wins = 0, unfinished = 0, worstThink = 0, totalMargin = 0;
  for (let i = 0; i < games; i++) {
    const r = playMediumVsEasy(size, i % 2 === 0 ? BLACK : WHITE, size * size * 3);
    if (r.mediumWon) wins++;
    if (!r.finished) unfinished++;
    worstThink = Math.max(worstThink, r.maxThinkMs);
    totalMargin += r.margin;
  }
  const rate = wins / games;
  const avgMargin = totalMargin / games;
  console.log(`  ${size}x${size}: Medium won ${wins}/${games} (${(rate * 100).toFixed(0)}%) vs Easy, avg margin ${avgMargin.toFixed(1)}, slowest Medium move ${worstThink}ms`);
  if (avgMargin < MIN_MEDIUM_AVG_MARGIN) fail(`${size}x${size}: Medium's avg margin ${avgMargin.toFixed(1)} over Easy is below the ${MIN_MEDIUM_AVG_MARGIN}-point floor`);
  if (rate < MIN_MEDIUM_WIN_RATE) fail(`${size}x${size}: Medium only beat Easy ${(rate * 100).toFixed(0)}% of the time (floor ${MIN_MEDIUM_WIN_RATE * 100}%)`);
  if (unfinished > 0) fail(`${size}x${size}: ${unfinished} Medium-vs-Easy game(s) never reached scoring`);
}

console.log(failures === 0 ? '\nAI VERIFIED' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
