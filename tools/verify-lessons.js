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

console.log(`\n${walkthroughCount} walkthroughs (${stepCount} steps), ${practiceCount} practice lessons`);
console.log(failures === 0 ? 'ALL LESSONS VERIFIED' : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
