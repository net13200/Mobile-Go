// Verifies every tutorial lesson against the real game engine.
// Run: node tools/verify-lessons.js
//
// Walkthroughs: every step's stones must be in bounds with no duplicate points.
// Practice: playing the documented solutionMoves must satisfy checkSuccess,
// and the initial position must be legal/enclosed as intended.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = { window: undefined, console };
vm.createContext(sandbox);

for (const file of ['js/go-engine.js', 'js/tutorial-helpers.js', 'js/tutorial-content.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
}

// `const` declarations don't land on the sandbox object, so pull them out
// by evaluating inside the context.
const { TUTORIAL_MODULES, GoGame, BLACK, WHITE, EMPTY } = vm.runInContext(
  '({ TUTORIAL_MODULES, GoGame, BLACK, WHITE, EMPTY })', sandbox);

let failures = 0;
let practiceCount = 0;
let walkthroughCount = 0;
let stepCount = 0;
let gameCount = 0;
let moveCount = 0;

// Counts empty regions that touch both colours — i.e. boundaries still open.
// A finished game should have none.
function unsettledRegions(game, size) {
  const visited = new Array(size * size).fill(false);
  let open = 0;
  for (let idx = 0; idx < size * size; idx++) {
    if (game.board[idx] !== EMPTY || visited[idx]) continue;
    const region = [idx];
    visited[idx] = true;
    const borders = new Set();
    let qi = 0;
    while (qi < region.length) {
      const cur = region[qi++];
      for (const n of game.neighbors(cur)) {
        if (game.board[n] === EMPTY) {
          if (!visited[n]) { visited[n] = true; region.push(n); }
        } else {
          borders.add(game.board[n]);
        }
      }
    }
    if (borders.size !== 1) open++;
  }
  return open;
}

function fail(lessonId, msg) {
  failures++;
  console.log(`  FAIL  ${lessonId}: ${msg}`);
}

function checkStones(lessonId, label, stones, size) {
  const seen = new Set();
  for (const s of stones) {
    if (s.row < 0 || s.row >= size || s.col < 0 || s.col >= size) {
      fail(lessonId, `${label}: point (${s.row},${s.col}) is off a ${size}x${size} board`);
    }
    const key = `${s.row},${s.col}`;
    if (seen.has(key)) fail(lessonId, `${label}: duplicate stone at (${s.row},${s.col})`);
    seen.add(key);
    if (s.color !== BLACK && s.color !== WHITE) {
      fail(lessonId, `${label}: stone at (${s.row},${s.col}) has no valid color`);
    }
  }
}

function checkMarkers(lessonId, label, markers, size) {
  if (!markers) return;
  for (const m of markers) {
    if (m.row < 0 || m.row >= size || m.col < 0 || m.col >= size) {
      fail(lessonId, `${label}: marker (${m.row},${m.col}) is off the board`);
    }
  }
}

for (const mod of TUTORIAL_MODULES) {
  console.log(`\n${mod.title} (${mod.lessons.length} lessons)`);
  for (const lesson of mod.lessons) {
    const size = lesson.boardSize || 9;

    if (lesson.type === 'walkthrough') {
      walkthroughCount++;
      if (!lesson.steps || !lesson.steps.length) { fail(lesson.id, 'no steps'); continue; }
      lesson.steps.forEach((step, i) => {
        stepCount++;
        checkStones(lesson.id, `step ${i + 1}`, step.stones, size);
        checkMarkers(lesson.id, `step ${i + 1}`, step.markers, size);
        if (!step.caption) fail(lesson.id, `step ${i + 1}: missing caption`);
        // The lesson player loads each step via loadPosition, so it must load cleanly.
        const g = new GoGame(size, 0);
        g.loadPosition(step.stones, BLACK);
      });
      console.log(`  ok    ${lesson.id} (${lesson.steps.length} steps)`);
      continue;
    }

    if (lesson.type === 'game') {
      gameCount++;
      if (!lesson.moves || !lesson.moves.length) { fail(lesson.id, 'no moves'); continue; }
      if (!lesson.intro) fail(lesson.id, 'missing intro');
      if (!lesson.summary) fail(lesson.id, 'missing summary');

      // Replay exactly the way the lesson player does. A recorded game is
      // only worth shipping if the real engine accepts every move of it.
      const game = new GoGame(size, lesson.komi || 0);
      lesson.moves.forEach((m, i) => {
        moveCount++;
        if (!m.note) fail(lesson.id, `move ${i + 1}: missing commentary`);
        if (m.pass) {
          if (game.scoringPhase) fail(lesson.id, `move ${i + 1}: pass came after the game already ended`);
          game.pass();
          return;
        }
        if (m.row < 0 || m.row >= size || m.col < 0 || m.col >= size) {
          fail(lesson.id, `move ${i + 1}: (${m.row},${m.col}) is off a ${size}x${size} board`);
          return;
        }
        const res = game.playMove(m.row, m.col);
        if (!res.legal) fail(lesson.id, `move ${i + 1}: (${m.row},${m.col}) is illegal — ${res.reason}`);
      });

      if (lesson.showFinalTerritory) {
        // The final step shades territory, so the position must actually be
        // finished: every empty region sealed to a single colour. A leaky
        // boundary would shade nothing and silently misrepresent the result.
        const open = unsettledRegions(game, size);
        if (open > 0) {
          fail(lesson.id, `${open} empty region(s) still border both colours — position is not finished, so territory must not be shaded`);
        }
        // Any group left dead-but-uncaptured would be scored as alive here,
        // so a recorded game has to play its captures out to the end.
        const s = game.computeScore();
        if (!lesson.finalScore) {
          fail(lesson.id, 'a finished game must declare finalScore so the count can be checked');
        } else {
          if (s.blackScore !== lesson.finalScore.black || s.whiteScore !== lesson.finalScore.white) {
            fail(lesson.id, `declared finalScore B ${lesson.finalScore.black}/W ${lesson.finalScore.white} ` +
                            `but the engine scores B ${s.blackScore}/W ${s.whiteScore}`);
          }
          // The summary quotes the result in prose; keep it from drifting
          // away from the numbers the engine actually produces.
          for (const n of [String(lesson.finalScore.black), String(lesson.finalScore.white)]) {
            if (!lesson.summary.includes(n)) {
              fail(lesson.id, `summary text does not mention the final score "${n}"`);
            }
          }
        }
        console.log(`  ok    ${lesson.id} (${lesson.moves.length} moves, final B ${s.blackScore} / W ${s.whiteScore})`);
      } else {
        if (lesson.finalScore) {
          fail(lesson.id, 'declares finalScore but does not show final territory — an unfinished study has no score');
        }
        console.log(`  ok    ${lesson.id} (${lesson.moves.length} moves, unfinished study)`);
      }
      continue;
    }

    practiceCount++;
    checkStones(lesson.id, 'initial', lesson.initialStones, size);
    checkMarkers(lesson.id, 'initial', lesson.markers, size);
    if (!lesson.goal) fail(lesson.id, 'missing goal text');
    if (!lesson.solutionMoves || !lesson.solutionMoves.length) {
      fail(lesson.id, 'no solutionMoves — cannot verify');
      continue;
    }

    // Rebuild exactly the way tutorial.js does.
    const game = new GoGame(size, 0);
    game.loadPosition(lesson.initialStones, lesson.toPlay);
    if (lesson.setupMoves) {
      for (const m of lesson.setupMoves) {
        const r = game.playMove(m.row, m.col);
        if (!r.legal) fail(lesson.id, `setupMove (${m.row},${m.col}) was rejected: ${r.reason}`);
      }
    }

    let result = null;
    for (const m of lesson.solutionMoves) {
      result = game.playMove(m.row, m.col);
    }
    const passed = lesson.checkSuccess(game, result);
    if (!passed) {
      fail(lesson.id, `solutionMoves did not satisfy checkSuccess (last move legal=${result.legal} reason=${result.reason})`);
    } else {
      console.log(`  ok    ${lesson.id}`);
    }

    // A wrong-but-legal move must NOT pass, otherwise the check is vacuous.
    // Try a far-away empty point as a control.
    const control = new GoGame(size, 0);
    control.loadPosition(lesson.initialStones, lesson.toPlay);
    if (lesson.setupMoves) for (const m of lesson.setupMoves) control.playMove(m.row, m.col);
    let controlPoint = null;
    for (let r = size - 1; r >= 0 && !controlPoint; r--) {
      for (let c = size - 1; c >= 0 && !controlPoint; c--) {
        const isSolution = lesson.solutionMoves.some((m) => m.row === r && m.col === c);
        if (control.board[control.index(r, c)] === EMPTY && !isSolution) controlPoint = { row: r, col: c };
      }
    }
    if (controlPoint) {
      const cr = control.playMove(controlPoint.row, controlPoint.col);
      if (cr.legal && lesson.checkSuccess(control, cr)) {
        fail(lesson.id, `control move (${controlPoint.row},${controlPoint.col}) also passes — check is too loose`);
      }
    }
  }
}

console.log(`\n${walkthroughCount} walkthroughs (${stepCount} steps), ${practiceCount} practice lessons, ` +
            `${gameCount} recorded games (${moveCount} commented moves)`);
console.log(failures === 0 ? 'ALL LESSONS VERIFIED' : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
