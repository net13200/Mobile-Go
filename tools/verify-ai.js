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
const sandbox = { console, window: undefined };
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
    const pick = Math.floor(Math.random() * empties.length);
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

console.log('AI vs random player');
for (const size of [9, 13, 19]) {
  const games = size === 19 ? 6 : 12;
  let wins = 0, unfinished = 0, worstThink = 0, totalMargin = 0;
  for (let i = 0; i < games; i++) {
    const r = playGame(size, i % 2 === 0 ? BLACK : WHITE, size * size * 3);
    if (r.aiWon) wins++;
    if (!r.finished) unfinished++;
    worstThink = Math.max(worstThink, r.maxThinkMs);
    totalMargin += r.margin;
  }
  const avg = (totalMargin / games).toFixed(1);
  console.log(`  ${size}x${size}: won ${wins}/${games}, avg margin ${avg}, slowest move ${worstThink}ms, unfinished ${unfinished}`);
  if (wins < games) fail(`${size}x${size}: AI lost ${games - wins} game(s) to a random player`);
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

console.log(failures === 0 ? '\nAI VERIFIED' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
