// Tutorial curriculum data. Plain script-tag global, no build step.
// Every position below has been checked against the real GoGame engine
// (captures/suicide/ko all verified), not just hand-drawn.
//
// Lesson shape:
//   walkthrough: { id, title, type:'walkthrough', boardSize, steps:[
//     { stones, caption, lastMove?, markers?, showTerritory? }, ...
//   ]}
//   practice: { id, title, type:'practice', boardSize, initialStones, toPlay,
//     setupMoves?, goal, markers?, hints?, maxAttempts?, checkSuccess(game, moveResult),
//     solutionMoves? }
//   game: { id, title, type:'game', boardSize, komi, intro, summary,
//     showFinalTerritory?, moves:[{ row, col, note } | { pass:true, note }, ...] }
//     — a recorded game replayed through the real engine one move at a time.
//     Moves alternate from Black; only the move list is stored, so the board
//     for any step is rebuilt by actually playing it. Set showFinalTerritory
//     only on a game played out to a finished, fully sealed position.

// ---- Shared positions, so a shape used by several lessons is written once. ----

const B_ = (row, col) => ({ row, col, color: BLACK });
const W_ = (row, col) => ({ row, col, color: WHITE });

// Recorded-game move helpers.
const M = (row, col, note) => ({ row, col, note });
const PASS = (note) => ({ pass: true, note });

// Black alive in the corner with two one-point eyes at (0,0) and (0,2).
const ALIVE_SHAPE = [
  B_(0, 1), B_(0, 3), B_(1, 0), B_(1, 1), B_(1, 2), B_(1, 3),
  W_(0, 4), W_(1, 4), W_(2, 0), W_(2, 1), W_(2, 2), W_(2, 3), W_(2, 4),
];

// Black with a single eye at (0,0) — White can play there and capture.
const ONE_EYE_SHAPE = [
  B_(0, 1), B_(1, 0), B_(1, 1),
  W_(0, 2), W_(1, 2), W_(2, 0), W_(2, 1), W_(2, 2),
];

// (0,0) looks like a Black eye, but both neighbouring stones are in atari.
const FALSE_EYE_SHAPE = [B_(0, 1), B_(1, 0), W_(1, 1), W_(0, 2), W_(2, 0)];

// A surrounded group with a straight-three eye space at (0,0)-(0,2).
const EYE_SPACE_BLACK = [
  B_(0, 3), B_(1, 0), B_(1, 1), B_(1, 2), B_(1, 3),
  W_(0, 4), W_(1, 4), W_(2, 0), W_(2, 1), W_(2, 2), W_(2, 3), W_(2, 4),
];
const EYE_SPACE_WHITE = [
  W_(0, 3), W_(1, 0), W_(1, 1), W_(1, 2), W_(1, 3),
  B_(0, 4), B_(1, 4), B_(2, 0), B_(2, 1), B_(2, 2), B_(2, 3), B_(2, 4),
];

// White with a bent-three eye space at (0,0),(0,1),(1,0); vital point is (0,0).
const BENT_THREE = [
  W_(0, 2), W_(1, 1), W_(1, 2), W_(2, 0), W_(2, 1), W_(2, 2),
  B_(0, 3), B_(1, 3), B_(2, 3), B_(3, 0), B_(3, 1), B_(3, 2), B_(3, 3),
];

// Two White stones with exactly two liberties, at (4,3) and (4,6).
const SENTE_SHAPE = [
  W_(4, 4), W_(4, 5),
  B_(3, 4), B_(3, 5), B_(5, 4), B_(5, 5),
];

// Facing walls: Black column 3, White column 5, column 4 neutral.
const WALL_POSITION = (() => {
  const s = [];
  for (let r = 0; r < 9; r++) { s.push(B_(r, 3)); s.push(W_(r, 5)); }
  return s;
})();

// The same walls, but Black's is missing its bottom stone — a big open boundary.
const ENDGAME_GAP = (() => {
  const s = [];
  for (let r = 0; r < 8; r++) s.push(B_(r, 3));
  for (let r = 0; r < 9; r++) s.push(W_(r, 5));
  return s;
})();

// Black and White locked in a capturing race, two liberties each.
const SEMEAI_SHAPE = [
  B_(4, 2), B_(4, 3), B_(4, 4), W_(4, 5), W_(4, 6), W_(4, 7),
  W_(3, 2), W_(3, 3), W_(3, 4), W_(5, 2), W_(5, 4),
  B_(3, 5), B_(3, 6), B_(3, 7), B_(5, 5), B_(5, 7),
];

const LADDER_START = [W_(5, 3), B_(4, 3), B_(5, 2), B_(6, 4)];

// 13x13 enclosures showing the cost of territory in each part of the board.
const CORNER_ENCLOSURE = [B_(0, 3), B_(1, 3), B_(2, 3), B_(3, 0), B_(3, 1), B_(3, 2)];
const SIDE_ENCLOSURE = [B_(0, 4), B_(1, 4), B_(2, 4), B_(0, 8), B_(1, 8), B_(2, 8), B_(3, 5), B_(3, 6), B_(3, 7)];
const CENTER_ENCLOSURE = [
  B_(4, 5), B_(4, 6), B_(4, 7), B_(8, 5), B_(8, 6), B_(8, 7),
  B_(5, 4), B_(6, 4), B_(7, 4), B_(5, 8), B_(6, 8), B_(7, 8),
];
const REGION_MARKERS = (top, left) => {
  const m = [];
  for (let r = top; r < top + 3; r++) for (let c = left; c < left + 3; c++) m.push({ row: r, col: c, type: 'ring' });
  return m;
};

const TUTORIAL_MODULES = [
  {
    id: 'basics',
    title: 'Rules Basics',
    lessons: [
      {
        id: 'basics-intro', title: 'What is Go?', type: 'walkthrough', boardSize: 9,
        steps: [
          { stones: [],
            caption: 'Go is played by two players, Black and White, who alternate placing stones on an empty board. Black moves first. The goal is to control more of the board than your opponent by the time the game ends.' },
        ],
      },
      {
        id: 'basics-board', title: 'The Board', type: 'walkthrough', boardSize: 9,
        steps: [
          { stones: [],
            caption: 'Stones go on the intersections — the points where the lines cross — not inside the squares like chess or checkers.',
            markers: [{ row: 4, col: 4, type: 'ring' }, { row: 2, col: 2, type: 'ring' }, { row: 6, col: 6, type: 'ring' }] },
          { stones: [{ row: 4, col: 4, color: BLACK }],
            caption: 'Here is a stone placed on the board’s center point.' },
        ],
      },
      {
        id: 'basics-liberties', title: 'Liberties', type: 'walkthrough', boardSize: 9,
        steps: [
          { stones: [{ row: 4, col: 4, color: BLACK }],
            caption: 'A lone stone has four liberties — the open points directly touching it, up/down/left/right.',
            markers: [{ row: 3, col: 4, type: 'ring' }, { row: 5, col: 4, type: 'ring' }, { row: 4, col: 3, type: 'ring' }, { row: 4, col: 5, type: 'ring' }] },
          { stones: [{ row: 4, col: 4, color: BLACK }, { row: 3, col: 4, color: WHITE }], lastMove: { row: 3, col: 4, color: WHITE },
            caption: 'White removes one liberty by playing next to it. Three liberties remain.',
            markers: [{ row: 5, col: 4, type: 'ring' }, { row: 4, col: 3, type: 'ring' }, { row: 4, col: 5, type: 'ring' }] },
          { stones: [{ row: 4, col: 4, color: BLACK }, { row: 3, col: 4, color: WHITE }, { row: 4, col: 3, color: WHITE }, { row: 5, col: 4, color: WHITE }], lastMove: { row: 5, col: 4, color: WHITE },
            caption: 'One liberty left — this is called atari. One more White move here would capture the stone.',
            markers: [{ row: 4, col: 5, type: 'target' }] },
        ],
      },
      {
        id: 'basics-capturing', title: 'Capturing', type: 'walkthrough', boardSize: 9,
        steps: [
          { stones: [{ row: 4, col: 4, color: WHITE }, { row: 3, col: 4, color: BLACK }, { row: 4, col: 3, color: BLACK }, { row: 5, col: 4, color: BLACK }], lastMove: { row: 5, col: 4, color: BLACK },
            caption: 'This White stone is in atari — one liberty left, at the marked point.',
            markers: [{ row: 4, col: 5, type: 'target' }] },
          { stones: [{ row: 3, col: 4, color: BLACK }, { row: 4, col: 3, color: BLACK }, { row: 5, col: 4, color: BLACK }, { row: 4, col: 5, color: BLACK }], lastMove: { row: 4, col: 5, color: BLACK },
            caption: 'Black plays the last liberty. The White stone has zero liberties, so it is captured and removed from the board.' },
        ],
      },
      {
        id: 'basics-capture-in-one', title: 'Capture in One', type: 'practice', boardSize: 9,
        initialStones: [
          { row: 2, col: 2, color: WHITE },
          { row: 1, col: 2, color: BLACK }, { row: 3, col: 2, color: BLACK }, { row: 2, col: 1, color: BLACK },
        ],
        toPlay: BLACK,
        goal: 'Capture the marked White stone in one move.',
        markers: [{ row: 2, col: 2, type: 'target' }],
        hints: ['White has only one liberty left. Find it.', 'Play directly to the right of the White stone.'],
        maxAttempts: 3,
        checkSuccess(game, moveResult) { return moveResult.legal && moveResult.captured >= 1; },
        solutionMoves: [{ row: 2, col: 3, color: BLACK }],
      },
      {
        id: 'basics-suicide', title: 'Suicide', type: 'walkthrough', boardSize: 9,
        steps: [
          { stones: [{ row: 3, col: 4, color: WHITE }, { row: 5, col: 4, color: WHITE }, { row: 4, col: 3, color: WHITE }, { row: 4, col: 5, color: WHITE }],
            caption: 'If Black played on the marked point, the new stone would have zero liberties right away — completely surrounded, with no White stones being captured to open one up.',
            markers: [{ row: 4, col: 4, type: 'target' }] },
          { stones: [{ row: 3, col: 4, color: WHITE }, { row: 5, col: 4, color: WHITE }, { row: 4, col: 3, color: WHITE }, { row: 4, col: 5, color: WHITE }],
            caption: 'That move is illegal — it’s called suicide. You can never play a stone that leaves your own group with zero liberties, unless doing so captures an opponent group first.' },
        ],
      },
      {
        id: 'basics-suicide-spot', title: 'Spot the Illegal Move', type: 'practice', boardSize: 9,
        initialStones: [
          { row: 3, col: 4, color: WHITE }, { row: 5, col: 4, color: WHITE }, { row: 4, col: 3, color: WHITE }, { row: 4, col: 5, color: WHITE },
        ],
        toPlay: BLACK,
        goal: 'Try playing Black on the marked point and see what happens.',
        markers: [{ row: 4, col: 4, type: 'target' }],
        hints: ['Count the liberties that point would have if Black played there.', 'It’s fully surrounded by White — and no White stone gets captured, so no liberty opens up.'],
        maxAttempts: 3,
        checkSuccess(game, moveResult) { return !moveResult.legal && moveResult.reason === 'suicide'; },
        solutionMoves: [{ row: 4, col: 4 }],
      },
      {
        id: 'basics-ko', title: 'Ko', type: 'walkthrough', boardSize: 9,
        steps: [
          { stones: [
              { row: 1, col: 3, color: BLACK }, { row: 2, col: 4, color: BLACK }, { row: 3, col: 3, color: BLACK },
              { row: 1, col: 2, color: WHITE }, { row: 2, col: 1, color: WHITE }, { row: 2, col: 3, color: WHITE }, { row: 3, col: 2, color: WHITE },
            ],
            caption: 'White’s marked stone has only one liberty. Black is about to capture it.',
            markers: [{ row: 2, col: 3, type: 'target' }, { row: 2, col: 2, type: 'ring' }] },
          { stones: [
              { row: 1, col: 3, color: BLACK }, { row: 2, col: 4, color: BLACK }, { row: 3, col: 3, color: BLACK }, { row: 2, col: 2, color: BLACK },
              { row: 1, col: 2, color: WHITE }, { row: 2, col: 1, color: WHITE }, { row: 3, col: 2, color: WHITE },
            ],
            lastMove: { row: 2, col: 2, color: BLACK },
            caption: 'Black captures! But look closely — this new Black stone also has only one liberty, at the point White just vacated.',
            markers: [{ row: 2, col: 3, type: 'ring' }] },
          { stones: [
              { row: 1, col: 3, color: BLACK }, { row: 2, col: 4, color: BLACK }, { row: 3, col: 3, color: BLACK }, { row: 2, col: 2, color: BLACK },
              { row: 1, col: 2, color: WHITE }, { row: 2, col: 1, color: WHITE }, { row: 3, col: 2, color: WHITE },
            ],
            caption: 'If White immediately played back on that point, it would capture the lone Black stone and recreate the exact position from step one — forever.',
            markers: [{ row: 2, col: 3, type: 'target' }] },
          { stones: [
              { row: 1, col: 3, color: BLACK }, { row: 2, col: 4, color: BLACK }, { row: 3, col: 3, color: BLACK }, { row: 2, col: 2, color: BLACK },
              { row: 1, col: 2, color: WHITE }, { row: 2, col: 1, color: WHITE }, { row: 3, col: 2, color: WHITE },
            ],
            caption: 'The ko rule forbids that immediate recapture. White must play elsewhere first — a “ko threat” — before trying to retake the ko on a later turn.' },
        ],
      },
      {
        id: 'basics-ko-recognize', title: 'Recognize a Ko', type: 'practice', boardSize: 9,
        initialStones: [
          { row: 1, col: 3, color: BLACK }, { row: 2, col: 4, color: BLACK }, { row: 3, col: 3, color: BLACK },
          { row: 1, col: 2, color: WHITE }, { row: 2, col: 1, color: WHITE }, { row: 2, col: 3, color: WHITE }, { row: 3, col: 2, color: WHITE },
        ],
        toPlay: BLACK,
        setupMoves: [{ row: 2, col: 2 }],
        goal: 'Black just captured a stone here. Now it’s White’s turn — try retaking the ko at the marked point.',
        markers: [{ row: 2, col: 3, type: 'target' }],
        hints: ['Go ahead, try playing there.', 'The engine will block it — that’s the ko rule doing its job.'],
        maxAttempts: 3,
        checkSuccess(game, moveResult) { return !moveResult.legal && moveResult.reason === 'ko'; },
        solutionMoves: [{ row: 2, col: 3 }],
      },
      {
        id: 'basics-passing', title: 'Passing & Ending the Game', type: 'walkthrough', boardSize: 9,
        steps: [
          { stones: [{ row: 3, col: 3, color: BLACK }, { row: 5, col: 5, color: WHITE }, { row: 3, col: 5, color: BLACK }, { row: 5, col: 3, color: WHITE }],
            caption: 'On your turn you can place a stone — or pass, if you have no move left worth making.' },
          { stones: [{ row: 3, col: 3, color: BLACK }, { row: 5, col: 5, color: WHITE }, { row: 3, col: 5, color: BLACK }, { row: 5, col: 3, color: WHITE }],
            caption: 'When both players pass in a row, the game ends immediately and it’s time to count the score.' },
        ],
      },
      {
        id: 'basics-scoring', title: 'Scoring', type: 'walkthrough', boardSize: 9,
        steps: [
          { stones: (() => {
              const s = [];
              for (let r = 0; r < 9; r++) { s.push({ row: r, col: 3, color: BLACK }); s.push({ row: r, col: 5, color: WHITE }); }
              return s;
            })(),
            caption: 'When both players pass, we count each side’s territory — empty points surrounded by only one color.' },
          { stones: (() => {
              const s = [];
              for (let r = 0; r < 9; r++) { s.push({ row: r, col: 3, color: BLACK }); s.push({ row: r, col: 5, color: WHITE }); }
              return s;
            })(),
            showTerritory: true,
            caption: 'Shaded points show what’s counted here: everything left of Black’s wall is Black’s territory, everything right of White’s wall is White’s.' },
          { stones: (() => {
              const s = [];
              for (let r = 0; r < 9; r++) { s.push({ row: r, col: 3, color: BLACK }); s.push({ row: r, col: 5, color: WHITE }); }
              return s;
            })(),
            showTerritory: true,
            caption: 'Any opponent stones captured during the game — or marked dead at the end — count as prisoners, added on top of territory.' },
          { stones: (() => {
              const s = [];
              for (let r = 0; r < 9; r++) { s.push({ row: r, col: 3, color: BLACK }); s.push({ row: r, col: 5, color: WHITE }); }
              return s;
            })(),
            showTerritory: true,
            caption: 'White also receives komi — a bonus (often 6.5 points) to make up for Black’s first-move advantage. Whoever has the higher total wins.' },
        ],
      },
    ],
  },
  {
    id: 'tactics',
    title: 'Basic Capturing Tactics',
    lessons: [
      {
        id: 'tactics-atari', title: 'Atari', type: 'practice', boardSize: 9,
        initialStones: [
          { row: 4, col: 4, color: WHITE }, { row: 3, col: 4, color: BLACK }, { row: 5, col: 4, color: BLACK },
        ],
        toPlay: BLACK,
        goal: 'Put the marked White stone in atari — down to exactly one liberty — in one move.',
        markers: [{ row: 4, col: 4, type: 'target' }],
        hints: ['White currently has two liberties left. Either one works.', 'Play directly to the left or right of the White stone.'],
        maxAttempts: 3,
        checkSuccess(game, moveResult) {
          if (!moveResult.legal) return false;
          const idx = game.index(4, 4);
          if (game.board[idx] !== WHITE) return false;
          return game.getGroup(game.board, idx).liberties.size === 1;
        },
        solutionMoves: [{ row: 4, col: 3 }],
      },
      {
        id: 'tactics-ladders-intro', title: 'Ladders', type: 'walkthrough', boardSize: 9,
        steps: [
          { stones: [{ row: 5, col: 3, color: WHITE }, { row: 4, col: 3, color: BLACK }, { row: 5, col: 2, color: BLACK }, { row: 6, col: 4, color: BLACK }],
            caption: 'White has only two liberties. Black is about to chase it with repeated atari — this pattern is called a ladder.' },
          { stones: [{ row: 5, col: 3, color: WHITE }, { row: 5, col: 4, color: WHITE }, { row: 4, col: 3, color: BLACK }, { row: 5, col: 2, color: BLACK }, { row: 6, col: 4, color: BLACK }, { row: 6, col: 3, color: BLACK }], lastMove: { row: 5, col: 4, color: WHITE },
            caption: 'White escapes to its only liberty. But look — it still has just two liberties. Black chases again.' },
          { stones: [{ row: 5, col: 3, color: WHITE }, { row: 5, col: 4, color: WHITE }, { row: 4, col: 4, color: WHITE }, { row: 4, col: 3, color: BLACK }, { row: 5, col: 2, color: BLACK }, { row: 6, col: 4, color: BLACK }, { row: 6, col: 3, color: BLACK }, { row: 5, col: 5, color: BLACK }], lastMove: { row: 4, col: 4, color: WHITE },
            caption: 'White keeps running along the diagonal. Every time, Black’s chasing stone leaves exactly one escape route.' },
          { stones: [{ row: 5, col: 3, color: WHITE }, { row: 5, col: 4, color: WHITE }, { row: 4, col: 4, color: WHITE }, { row: 4, col: 5, color: WHITE }, { row: 4, col: 3, color: BLACK }, { row: 5, col: 2, color: BLACK }, { row: 6, col: 4, color: BLACK }, { row: 6, col: 3, color: BLACK }, { row: 5, col: 5, color: BLACK }, { row: 3, col: 4, color: BLACK }], lastMove: { row: 4, col: 5, color: WHITE },
            caption: 'The pattern repeats. If this continues to the edge of the board (or into another Black stone), White never escapes — it’s a doomed ladder.' },
          { stones: [{ row: 5, col: 3, color: WHITE }, { row: 5, col: 4, color: WHITE }, { row: 4, col: 4, color: WHITE }, { row: 4, col: 5, color: WHITE }, { row: 4, col: 3, color: BLACK }, { row: 5, col: 2, color: BLACK }, { row: 6, col: 4, color: BLACK }, { row: 6, col: 3, color: BLACK }, { row: 5, col: 5, color: BLACK }, { row: 3, col: 4, color: BLACK }],
            caption: 'A player who sees the ladder coming won’t even try to run — they’ll play elsewhere instead. Reading out ladders is one of the most important basic skills in Go.' },
        ],
      },
      {
        id: 'tactics-ladders-practice-1', title: 'Read a Ladder', type: 'practice', boardSize: 9,
        initialStones: [
          { row: 5, col: 3, color: WHITE }, { row: 4, col: 3, color: BLACK }, { row: 5, col: 2, color: BLACK }, { row: 6, col: 4, color: BLACK },
        ],
        toPlay: BLACK,
        goal: 'Continue the ladder — play the atari that keeps White trapped and on the run.',
        markers: [{ row: 5, col: 3, type: 'target' }],
        hints: ['White has two liberties. Try one and see whether it keeps White boxed in or lets it escape.', 'A move that keeps the fleeing group at exactly two liberties after it runs is the right one.'],
        maxAttempts: 4,
        checkSuccess(game, moveResult) {
          return moveResult.legal && TutorialHelpers.ladderContinues(game, 5, 3);
        },
        solutionMoves: [{ row: 6, col: 3 }],
      },
      {
        id: 'tactics-ladders-practice-2', title: 'Read a Longer Ladder', type: 'practice', boardSize: 9,
        initialStones: [
          { row: 5, col: 3, color: WHITE }, { row: 5, col: 4, color: WHITE }, { row: 4, col: 4, color: WHITE },
          { row: 4, col: 3, color: BLACK }, { row: 5, col: 2, color: BLACK }, { row: 6, col: 4, color: BLACK }, { row: 6, col: 3, color: BLACK }, { row: 5, col: 5, color: BLACK },
        ],
        toPlay: BLACK,
        goal: 'Keep reading — one more atari to continue the chase.',
        markers: [{ row: 5, col: 3, type: 'target' }],
        hints: ['Only one of White’s two liberties keeps the ladder working.', 'Try each and see which one avoids opening a third liberty.'],
        maxAttempts: 4,
        checkSuccess(game, moveResult) {
          return moveResult.legal && TutorialHelpers.ladderContinues(game, 5, 3);
        },
        solutionMoves: [{ row: 3, col: 4 }],
      },
      {
        id: 'tactics-nets', title: 'Nets (Geta)', type: 'walkthrough', boardSize: 9,
        steps: [
          { stones: [{ row: 4, col: 4, color: WHITE }, { row: 3, col: 4, color: BLACK }, { row: 4, col: 3, color: BLACK }],
            caption: 'A ladder isn’t the only way to trap a stone. Sometimes a single loose move, not even touching the stone, traps it just as surely — this is called a net, or geta.' },
          { stones: [{ row: 4, col: 4, color: WHITE }, { row: 3, col: 4, color: BLACK }, { row: 4, col: 3, color: BLACK }, { row: 6, col: 5, color: BLACK }], lastMove: { row: 6, col: 5, color: BLACK },
            caption: 'Black’s new stone doesn’t reduce White’s liberties at all right now. But wherever White tries to run, it walks straight into this stone’s reach and gets captured anyway.' },
          { stones: [{ row: 4, col: 4, color: WHITE }, { row: 3, col: 4, color: BLACK }, { row: 4, col: 3, color: BLACK }, { row: 6, col: 5, color: BLACK }],
            caption: 'Nets are more efficient than ladders — one move instead of a whole chase — but they only work in the right shape. Recognizing when a net works takes practice.' },
        ],
      },
      {
        id: 'tactics-double-atari', title: 'Double Atari', type: 'practice', boardSize: 9,
        initialStones: [
          { row: 3, col: 3, color: WHITE }, { row: 2, col: 3, color: BLACK }, { row: 4, col: 3, color: BLACK },
          { row: 3, col: 5, color: WHITE }, { row: 2, col: 5, color: BLACK }, { row: 4, col: 5, color: BLACK },
        ],
        toPlay: BLACK,
        goal: 'Find the single move that puts BOTH marked White stones in atari at once.',
        markers: [{ row: 3, col: 3, type: 'target' }, { row: 3, col: 5, type: 'target' }],
        hints: ['Each White stone has two liberties. One of them is shared.', 'Play the point directly between the two White stones.'],
        maxAttempts: 3,
        checkSuccess(game, moveResult) {
          if (!moveResult.legal) return false;
          const i1 = game.index(3, 3), i2 = game.index(3, 5);
          if (game.board[i1] !== WHITE || game.board[i2] !== WHITE) return false;
          return game.getGroup(game.board, i1).liberties.size === 1 && game.getGroup(game.board, i2).liberties.size === 1;
        },
        solutionMoves: [{ row: 3, col: 4, color: BLACK }],
      },
      {
        id: 'tactics-connect-cut', title: 'Connecting vs. Cutting', type: 'walkthrough', boardSize: 9,
        steps: [
          { stones: [{ row: 4, col: 2, color: BLACK }, { row: 4, col: 3, color: BLACK }, { row: 4, col: 5, color: BLACK }, { row: 4, col: 6, color: BLACK }],
            caption: 'These two Black groups are not yet connected — the marked point between them is a cutting point. If White plays there, the groups stay separate and each is weaker on its own.',
            markers: [{ row: 4, col: 4, type: 'ring' }] },
          { stones: [{ row: 4, col: 2, color: BLACK }, { row: 4, col: 3, color: BLACK }, { row: 4, col: 4, color: BLACK }, { row: 4, col: 5, color: BLACK }, { row: 4, col: 6, color: BLACK }], lastMove: { row: 4, col: 4, color: BLACK },
            caption: 'If Black plays the connecting point instead, all the stones become one solid, much harder to attack group.' },
        ],
      },
      {
        id: 'tactics-connect-practice', title: 'Connect the Groups', type: 'practice', boardSize: 9,
        initialStones: [
          { row: 4, col: 2, color: BLACK }, { row: 4, col: 3, color: BLACK }, { row: 4, col: 5, color: BLACK }, { row: 4, col: 6, color: BLACK },
        ],
        toPlay: BLACK,
        goal: 'Connect your two groups into one before White can cut them apart.',
        markers: [{ row: 4, col: 4, type: 'ring' }],
        hints: ['There’s exactly one point that links both groups together.'],
        maxAttempts: 3,
        checkSuccess(game, moveResult) {
          if (!moveResult.legal) return false;
          return game.getGroup(game.board, game.index(4, 2)).stones.has(game.index(4, 6));
        },
        solutionMoves: [{ row: 4, col: 4, color: BLACK }],
      },
      {
        id: 'tactics-cut-practice', title: 'Cut Them Apart', type: 'practice', boardSize: 9,
        initialStones: [
          { row: 4, col: 2, color: WHITE }, { row: 4, col: 3, color: WHITE }, { row: 4, col: 5, color: WHITE }, { row: 4, col: 6, color: WHITE },
        ],
        toPlay: BLACK,
        goal: 'Cut White’s two groups apart before they can connect.',
        markers: [{ row: 4, col: 4, type: 'ring' }],
        hints: ['Play on the point between the two White groups.'],
        maxAttempts: 3,
        checkSuccess(game, moveResult) {
          if (!moveResult.legal) return false;
          return game.board[game.index(4, 4)] === BLACK;
        },
        solutionMoves: [{ row: 4, col: 4, color: BLACK }],
      },
    ],
  },
  {
    id: 'life-death',
    title: 'Life and Death Basics',
    lessons: [
      {
        id: 'ld-eyes', title: 'What Is an Eye?', type: 'walkthrough', boardSize: 9,
        steps: [
          { stones: ALIVE_SHAPE,
            caption: 'An eye is an empty point completely surrounded by one player’s stones. This Black group is enclosed by White, but it has two eyes — the two marked points.',
            markers: [{ row: 0, col: 0, type: 'ring' }, { row: 0, col: 2, type: 'ring' }] },
          { stones: ALIVE_SHAPE,
            caption: 'White can never fill either one. Playing into a single eye would leave that stone with no liberties at all — suicide, which is illegal.',
            markers: [{ row: 0, col: 0, type: 'target' }] },
          { stones: ALIVE_SHAPE,
            caption: 'And White cannot capture the group either, because it can never take away both eyes at once. Two eyes means a group is alive — permanently safe.' },
        ],
      },
      {
        id: 'ld-one-eye', title: 'One Eye Is Not Enough', type: 'walkthrough', boardSize: 9,
        steps: [
          { stones: ONE_EYE_SHAPE,
            caption: 'This Black group has only one eye, and that eye is also its last liberty.',
            markers: [{ row: 0, col: 0, type: 'target' }] },
          { stones: ONE_EYE_SHAPE,
            caption: 'White can simply play there. It isn’t suicide, because the move takes Black’s final liberty and captures the whole group first.',
            markers: [{ row: 0, col: 0, type: 'target' }] },
          { stones: [
              { row: 0, col: 0, color: WHITE }, { row: 0, col: 2, color: WHITE }, { row: 1, col: 2, color: WHITE },
              { row: 2, col: 0, color: WHITE }, { row: 2, col: 1, color: WHITE }, { row: 2, col: 2, color: WHITE },
            ], lastMove: { row: 0, col: 0, color: WHITE },
            caption: 'All three Black stones come off the board. One eye is never enough — a group needs two separate eyes to live.' },
        ],
      },
      {
        id: 'ld-false-eyes', title: 'False Eyes', type: 'walkthrough', boardSize: 9,
        steps: [
          { stones: FALSE_EYE_SHAPE,
            caption: 'The marked point looks like an eye — it’s empty and both points next to it are Black.',
            markers: [{ row: 0, col: 0, type: 'ring' }] },
          { stones: FALSE_EYE_SHAPE,
            caption: 'But those two Black stones are separate groups, not one, and each of them has only this single liberty left. Both are in atari.',
            markers: [{ row: 0, col: 1, type: 'target' }, { row: 1, col: 0, type: 'target' }] },
          { stones: [
              { row: 0, col: 0, color: WHITE }, { row: 0, col: 2, color: WHITE },
              { row: 1, col: 1, color: WHITE }, { row: 2, col: 0, color: WHITE },
            ], lastMove: { row: 0, col: 0, color: WHITE },
            caption: 'White plays there and captures both stones. That was a false eye — it never counted. Always check that the stones around an eye are genuinely connected.' },
        ],
      },
      {
        id: 'ld-make-two-eyes', title: 'Make Two Eyes', type: 'practice', boardSize: 9,
        initialStones: EYE_SPACE_BLACK,
        toPlay: BLACK,
        goal: 'Black is surrounded with three empty points inside. Play the one move that makes two eyes and saves the group.',
        markers: [{ row: 0, col: 0, type: 'ring' }, { row: 0, col: 1, type: 'ring' }, { row: 0, col: 2, type: 'ring' }],
        hints: ['Three empty points in a row. Where would a stone split them into two separate eyes?', 'Play the middle one.'],
        maxAttempts: 3,
        checkSuccess(game) { return TutorialHelpers.countEyes(game, 1, 0) >= 2; },
        solutionMoves: [{ row: 0, col: 1 }],
      },
      {
        id: 'ld-vital-point', title: 'Find the Vital Point', type: 'practice', boardSize: 9,
        initialStones: EYE_SPACE_WHITE,
        toPlay: BLACK,
        goal: 'Now the shoe is on the other foot. White has a three-point eye space — play the vital point that stops White from ever making two eyes.',
        markers: [{ row: 0, col: 0, type: 'ring' }, { row: 0, col: 1, type: 'ring' }, { row: 0, col: 2, type: 'ring' }],
        hints: ['The point that saves a three-space group is the same point that kills it.', 'Take the middle before White can.'],
        maxAttempts: 3,
        checkSuccess(game) { return TutorialHelpers.playedAt(game, 0, 1); },
        solutionMoves: [{ row: 0, col: 1 }],
      },
      {
        id: 'ld-bent-three', title: 'Kill the Bent Three', type: 'practice', boardSize: 9,
        initialStones: BENT_THREE,
        toPlay: BLACK,
        goal: 'White’s eye space is bent around the corner. Find the vital point that kills it.',
        markers: [{ row: 0, col: 0, type: 'ring' }, { row: 0, col: 1, type: 'ring' }, { row: 1, col: 0, type: 'ring' }],
        hints: ['In a three-point eye space, the vital point is always the one in the middle of the shape.', 'Which of the three empty points touches both of the others?'],
        maxAttempts: 3,
        checkSuccess(game) { return TutorialHelpers.playedAt(game, 0, 0); },
        solutionMoves: [{ row: 0, col: 0 }],
      },
    ],
  },
  {
    id: 'shape',
    title: 'Shape',
    lessons: [
      {
        id: 'shape-empty-triangle', title: 'Good Shape, Bad Shape', type: 'walkthrough', boardSize: 9,
        steps: [
          { stones: [{ row: 4, col: 4, color: BLACK }, { row: 4, col: 5, color: BLACK }, { row: 5, col: 4, color: BLACK }],
            caption: 'Three Black stones bunched into an L. This is the empty triangle — the most famous bad shape in Go. Count its liberties: seven.' },
          { stones: [{ row: 4, col: 3, color: BLACK }, { row: 4, col: 4, color: BLACK }, { row: 4, col: 5, color: BLACK }],
            caption: 'The same three stones in a straight line have eight liberties. Same material, more freedom.' },
          { stones: [{ row: 4, col: 3, color: BLACK }, { row: 4, col: 4, color: BLACK }, { row: 4, col: 5, color: BLACK }],
            caption: 'That’s what good shape means: stones that work efficiently together rather than duplicating each other’s job. Avoid the empty triangle unless you have a concrete reason.' },
        ],
      },
      {
        id: 'shape-hane', title: 'Hane', type: 'walkthrough', boardSize: 9,
        steps: [
          { stones: [{ row: 4, col: 4, color: WHITE }, { row: 4, col: 3, color: BLACK }],
            caption: 'Black and White are in contact. Black wants to push White back without just crawling alongside.' },
          { stones: [{ row: 4, col: 4, color: WHITE }, { row: 4, col: 3, color: BLACK }, { row: 3, col: 4, color: BLACK }], lastMove: { row: 3, col: 4, color: BLACK },
            caption: 'This diagonal move around the far side of White’s stone is called a hane. It reaches further than a plain extension and takes away White’s room.' },
          { stones: [{ row: 4, col: 4, color: WHITE }, { row: 4, col: 3, color: BLACK }, { row: 3, col: 4, color: BLACK }],
            caption: 'Hane is aggressive and efficient, but it leaves a cutting point behind — the price of reaching further.' },
        ],
      },
      {
        id: 'shape-hane-practice', title: 'Play the Hane', type: 'practice', boardSize: 9,
        initialStones: [{ row: 4, col: 4, color: WHITE }, { row: 4, col: 3, color: BLACK }],
        toPlay: BLACK,
        goal: 'Play the hane — the diagonal move that wraps around the far side of White’s stone.',
        markers: [{ row: 4, col: 4, type: 'target' }],
        hints: ['Start from your own stone and go diagonally, past White.', 'Either side works — above or below White’s stone.'],
        maxAttempts: 3,
        checkSuccess(game) {
          return TutorialHelpers.playedAnyOf(game, [{ row: 3, col: 4 }, { row: 5, col: 4 }]);
        },
        solutionMoves: [{ row: 3, col: 4 }],
      },
      {
        id: 'shape-tigers-mouth', title: 'The Tiger’s Mouth', type: 'practice', boardSize: 9,
        initialStones: [{ row: 3, col: 4, color: BLACK }, { row: 4, col: 3, color: BLACK }],
        toPlay: BLACK,
        goal: 'Add one stone so that the marked point becomes a tiger’s mouth — any White stone played there would be in atari immediately.',
        markers: [{ row: 4, col: 4, type: 'target' }],
        hints: ['A tiger’s mouth needs three of your stones around the point, leaving one way out.', 'You already have two. Add a third next to the marked point.'],
        maxAttempts: 3,
        checkSuccess(game) { return TutorialHelpers.wouldBeAtari(game, 4, 4, WHITE); },
        solutionMoves: [{ row: 5, col: 4 }],
      },
    ],
  },
  {
    id: 'opening',
    title: 'Opening Principles',
    lessons: [
      {
        id: 'opening-corners-first', title: 'Corners, Sides, Centre', type: 'walkthrough', boardSize: 13,
        steps: [
          { stones: [],
            caption: 'Go openings follow one rule above all: corners first, then the sides, then the centre. Here’s why, counted in stones.',
            markers: [{ row: 3, col: 3, type: 'ring' }, { row: 3, col: 9, type: 'ring' }, { row: 9, col: 3, type: 'ring' }, { row: 9, col: 9, type: 'ring' }] },
          { stones: CORNER_ENCLOSURE,
            caption: 'In the corner, two edges do the work for you. Six stones enclose the nine marked points.',
            markers: REGION_MARKERS(0, 0) },
          { stones: SIDE_ENCLOSURE,
            caption: 'On the side, only one edge helps. The same nine points now cost nine stones.',
            markers: REGION_MARKERS(0, 5) },
          { stones: CENTER_ENCLOSURE,
            caption: 'In the centre there are no edges at all — twelve stones for the same nine points. Twice the cost of the corner.',
            markers: REGION_MARKERS(5, 5) },
          { stones: [],
            caption: 'So play the corners while they are open, take the big side points next, and only fight over the centre when there’s a reason to.',
            markers: [{ row: 3, col: 3, type: 'ring' }, { row: 3, col: 9, type: 'ring' }, { row: 9, col: 3, type: 'ring' }, { row: 9, col: 9, type: 'ring' }] },
        ],
      },
      {
        id: 'opening-star-vs-34', title: 'Star Point and 3-4 Point', type: 'walkthrough', boardSize: 13,
        steps: [
          { stones: [{ row: 3, col: 3, color: BLACK }], lastMove: { row: 3, col: 3, color: BLACK },
            caption: 'The star point (4-4) is balanced and fast. It doesn’t claim the corner outright, but it radiates influence in both directions along the sides.' },
          { stones: [{ row: 2, col: 3, color: BLACK }], lastMove: { row: 2, col: 3, color: BLACK },
            caption: 'The 3-4 point is lower and greedier. It leans toward taking the corner as real territory, but it’s slower and one-sided.' },
          { stones: [{ row: 3, col: 3, color: BLACK }, { row: 9, col: 2, color: BLACK }],
            caption: 'Neither is better — they’re different bargains. Star point trades territory for speed and influence; 3-4 trades speed for solid profit.' },
        ],
      },
      {
        id: 'opening-big-point', title: 'Take the Big Point', type: 'practice', boardSize: 13,
        initialStones: [
          { row: 3, col: 3, color: BLACK }, { row: 9, col: 3, color: BLACK },
          { row: 3, col: 9, color: WHITE }, { row: 6, col: 6, color: WHITE },
        ],
        toPlay: BLACK,
        goal: 'Three corners are already taken. Play the biggest point left on the board.',
        hints: ['Corners are worth more than sides, and sides more than the centre.', 'One corner star point is still empty.'],
        maxAttempts: 3,
        checkSuccess(game) { return TutorialHelpers.playedAt(game, 9, 9); },
        solutionMoves: [{ row: 9, col: 9 }],
      },
      {
        id: 'opening-moyo', title: 'Frameworks (Moyo)', type: 'walkthrough', boardSize: 13,
        steps: [
          { stones: [{ row: 3, col: 3, color: BLACK }, { row: 3, col: 6, color: BLACK }, { row: 3, col: 9, color: BLACK }],
            caption: 'Three Black stones spread across the top. None of this is territory yet — an opponent can still walk in. It’s a framework, or moyo: potential.' },
          { stones: [{ row: 3, col: 3, color: BLACK }, { row: 3, col: 6, color: BLACK }, { row: 3, col: 9, color: BLACK }, { row: 1, col: 6, color: WHITE }], lastMove: { row: 1, col: 6, color: WHITE },
            caption: 'White can invade underneath, living small along the edge — but Black gets a strong wall facing the rest of the board in exchange.' },
          { stones: [{ row: 3, col: 3, color: BLACK }, { row: 3, col: 6, color: BLACK }, { row: 3, col: 9, color: BLACK }],
            caption: 'That’s the trade a framework offers: your opponent can reduce it, but they spend moves doing so while you gain strength. Don’t panic when a moyo gets invaded — profit from the invasion.' },
        ],
      },
      {
        id: 'opening-overconcentration', title: 'Don’t Overconcentrate', type: 'walkthrough', boardSize: 13,
        steps: [
          { stones: [{ row: 3, col: 3, color: BLACK }, { row: 3, col: 4, color: BLACK }, { row: 4, col: 3, color: BLACK }, { row: 4, col: 4, color: BLACK }],
            caption: 'Four Black stones packed into one corner. They’re completely safe — and almost completely wasted. Four moves have secured only a handful of points.' },
          { stones: [{ row: 3, col: 3, color: BLACK }, { row: 3, col: 9, color: BLACK }, { row: 9, col: 3, color: BLACK }, { row: 9, col: 9, color: BLACK }],
            caption: 'The same four stones, spread across four corners, stake a claim on the whole board. In the opening, each stone should be doing a job the others aren’t.' },
        ],
      },
    ],
  },
  {
    id: 'middlegame',
    title: 'Middlegame Tactics',
    lessons: [
      {
        id: 'mid-sente', title: 'Sente and Gote', type: 'walkthrough', boardSize: 9,
        steps: [
          { stones: SENTE_SHAPE,
            caption: 'White’s two stones are nearly surrounded — they have just two liberties left, at the marked points.',
            markers: [{ row: 4, col: 3, type: 'ring' }, { row: 4, col: 6, type: 'ring' }] },
          { stones: [...SENTE_SHAPE, { row: 4, col: 6, color: BLACK }], lastMove: { row: 4, col: 6, color: BLACK },
            caption: 'Black takes one. Now White is in atari and must respond immediately or lose both stones — so Black keeps the initiative and gets to choose the next move too. A move like this is sente.' },
          { stones: [...SENTE_SHAPE, { row: 4, col: 6, color: BLACK }],
            caption: 'A move your opponent can ignore is gote — you spend a turn and hand them the initiative. Playing your sente moves first, while they still work, is one of the biggest skills in the middlegame.' },
        ],
      },
      {
        id: 'mid-find-sente', title: 'Find the Sente Move', type: 'practice', boardSize: 9,
        initialStones: SENTE_SHAPE,
        toPlay: BLACK,
        goal: 'Play the move that forces White to answer.',
        markers: [{ row: 4, col: 4, type: 'target' }, { row: 4, col: 5, type: 'target' }],
        hints: ['White’s two stones have two liberties. Take one of them.', 'Either end of White’s group works.'],
        maxAttempts: 3,
        checkSuccess(game) { return TutorialHelpers.groupLiberties(game, 4, 4) === 1; },
        solutionMoves: [{ row: 4, col: 6 }],
      },
      {
        id: 'mid-invade-reduce', title: 'Invade or Reduce', type: 'walkthrough', boardSize: 13,
        steps: [
          { stones: [{ row: 3, col: 2, color: BLACK }, { row: 3, col: 6, color: BLACK }, { row: 3, col: 10, color: BLACK }, { row: 6, col: 2, color: BLACK }],
            caption: 'Black has built a large sphere of influence. White has to do something about it — but there are two very different ways in.' },
          { stones: [{ row: 3, col: 2, color: BLACK }, { row: 3, col: 6, color: BLACK }, { row: 3, col: 10, color: BLACK }, { row: 6, col: 2, color: BLACK }, { row: 1, col: 8, color: WHITE }], lastMove: { row: 1, col: 8, color: WHITE },
            caption: 'An invasion goes deep, aiming to live inside. It destroys the most territory — but the invading group starts weak and may spend many moves just surviving.' },
          { stones: [{ row: 3, col: 2, color: BLACK }, { row: 3, col: 6, color: BLACK }, { row: 3, col: 10, color: BLACK }, { row: 6, col: 2, color: BLACK }, { row: 5, col: 7, color: WHITE }], lastMove: { row: 5, col: 7, color: WHITE },
            caption: 'A reduction stays shallow, shaving the framework from outside where escape is easy. It gains less, but it’s safe. Choose by the score: behind, invade; ahead, reduce.' },
        ],
      },
      {
        id: 'mid-save-group', title: 'Save the Weak Group', type: 'practice', boardSize: 9,
        initialStones: [
          { row: 4, col: 4, color: BLACK },
          { row: 3, col: 4, color: WHITE }, { row: 4, col: 3, color: WHITE }, { row: 5, col: 4, color: WHITE },
        ],
        toPlay: BLACK,
        goal: 'Black’s stone is in atari. Play the move that rescues it.',
        markers: [{ row: 4, col: 4, type: 'target' }],
        hints: ['The stone has one liberty left. Extending onto it gives the group room to breathe.', 'Play to the right of the Black stone.'],
        maxAttempts: 3,
        checkSuccess(game) { return TutorialHelpers.groupLiberties(game, 4, 4) >= 2; },
        solutionMoves: [{ row: 4, col: 5 }],
      },
    ],
  },
  {
    id: 'endgame',
    title: 'Endgame Basics',
    lessons: [
      {
        id: 'end-counting', title: 'Counting the Score', type: 'walkthrough', boardSize: 9,
        steps: [
          { stones: WALL_POSITION,
            caption: 'As the board fills up, the game stops being about fighting and starts being about arithmetic. Learn to count before you decide what to play.' },
          { stones: WALL_POSITION, showTerritory: true,
            caption: 'Shaded points are settled territory: 27 for Black on the left, 27 for White on the right. Add White’s komi and White is ahead by 6.5.' },
          { stones: WALL_POSITION, showTerritory: true,
            caption: 'Knowing you’re 6.5 behind changes everything — it tells you to take risks. Knowing you’re ahead tells you to simplify. You can check this any time in a real game with the Score button.' },
        ],
      },
      {
        id: 'end-big-points', title: 'Biggest Point First', type: 'practice', boardSize: 9,
        initialStones: ENDGAME_GAP,
        toPlay: BLACK,
        goal: 'Two moves are marked. One seals Black’s whole side; the other fills a neutral point worth nothing. Play the big one.',
        markers: [{ row: 8, col: 3, type: 'target' }, { row: 0, col: 4, type: 'target' }],
        hints: ['Black’s wall has a hole in it. Follow the wall down to the bottom edge.', 'The column between the two walls belongs to nobody — filling it gains zero.'],
        maxAttempts: 3,
        checkSuccess(game) { return TutorialHelpers.playedAt(game, 8, 3); },
        solutionMoves: [{ row: 8, col: 3 }],
      },
      {
        id: 'end-sente-endgame', title: 'Endgame Sente', type: 'walkthrough', boardSize: 9,
        steps: [
          { stones: WALL_POSITION,
            caption: 'Endgame moves come in two flavours, and the difference is worth more than most beginners realise.' },
          { stones: WALL_POSITION,
            caption: 'A sente endgame move forces an answer, so you play it and still keep the initiative — effectively it’s free. Play all of those before anything else.' },
          { stones: WALL_POSITION,
            caption: 'A gote move ends your turn. Save them for last, biggest first. Two players of equal reading strength can be separated by ten points purely on endgame move order.' },
        ],
      },
      {
        id: 'end-dame', title: 'Dame', type: 'walkthrough', boardSize: 9,
        steps: [
          { stones: WALL_POSITION, showTerritory: true,
            caption: 'Look at the column between the two walls. It isn’t shaded, because it touches both colours — it belongs to nobody.',
            markers: [{ row: 4, col: 4, type: 'ring' }] },
          { stones: WALL_POSITION,
            caption: 'These neutral points are called dame. Filling them scores nothing at all.' },
          { stones: WALL_POSITION,
            caption: 'Under territory scoring, playing dame while real points remain elsewhere simply wastes a move. When only dame are left, the game is over — both players pass.' },
        ],
      },
    ],
  },
  {
    id: 'advanced',
    title: 'Advanced',
    lessons: [
      {
        id: 'adv-semeai', title: 'Capturing Races', type: 'walkthrough', boardSize: 9,
        steps: [
          { stones: SEMEAI_SHAPE,
            caption: 'Black and White are locked together, each group surrounded by the other. Neither can make eyes. This is a semeai — a capturing race, and it is decided purely by counting.' },
          { stones: SEMEAI_SHAPE,
            caption: 'Count liberties. Black has two, at the marked points. White also has two. Equal liberties — so whoever plays first wins the race.',
            markers: [{ row: 4, col: 1, type: 'ring' }, { row: 5, col: 3, type: 'ring' }, { row: 5, col: 6, type: 'target' }, { row: 4, col: 8, type: 'target' }] },
          { stones: SEMEAI_SHAPE,
            caption: 'The rule: in a race with no eyes and no shared liberties, fill your opponent’s liberties, never your own. Count before you start — if you’re a liberty behind, don’t fight the race at all.' },
        ],
      },
      {
        id: 'adv-win-race', title: 'Win the Capturing Race', type: 'practice', boardSize: 9,
        initialStones: SEMEAI_SHAPE,
        toPlay: BLACK,
        goal: 'Both groups have two liberties and it’s Black’s move. Start the race correctly.',
        markers: [{ row: 5, col: 6, type: 'target' }, { row: 4, col: 8, type: 'target' }],
        hints: ['Never fill your own liberties in a capturing race.', 'Take one of White’s two liberties — either of the marked points.'],
        maxAttempts: 3,
        checkSuccess(game) { return TutorialHelpers.groupLiberties(game, 4, 5) === 1; },
        solutionMoves: [{ row: 4, col: 8 }],
      },
      {
        id: 'adv-ladder-breaker', title: 'Ladder Breakers', type: 'walkthrough', boardSize: 9,
        steps: [
          { stones: [...LADDER_START, { row: 2, col: 6, color: WHITE }],
            caption: 'The same ladder as before — but this time White already has a stone sitting far away, right on the path the ladder will travel.',
            markers: [{ row: 2, col: 6, type: 'target' }] },
          { stones: [
              { row: 2, col: 5, color: BLACK }, { row: 2, col: 6, color: WHITE },
              { row: 3, col: 4, color: BLACK }, { row: 3, col: 5, color: WHITE },
              { row: 4, col: 3, color: BLACK }, { row: 4, col: 4, color: WHITE }, { row: 4, col: 5, color: WHITE }, { row: 4, col: 6, color: BLACK },
              { row: 5, col: 2, color: BLACK }, { row: 5, col: 3, color: WHITE }, { row: 5, col: 4, color: WHITE }, { row: 5, col: 5, color: BLACK },
              { row: 6, col: 3, color: BLACK }, { row: 6, col: 4, color: BLACK },
            ], lastMove: { row: 2, col: 5, color: BLACK },
            caption: 'Black chases anyway. Four rungs in, White’s running group is about to reach that waiting stone.' },
          { stones: [
              { row: 2, col: 5, color: BLACK }, { row: 2, col: 6, color: WHITE },
              { row: 3, col: 4, color: BLACK }, { row: 3, col: 5, color: WHITE }, { row: 3, col: 6, color: WHITE },
              { row: 4, col: 3, color: BLACK }, { row: 4, col: 4, color: WHITE }, { row: 4, col: 5, color: WHITE }, { row: 4, col: 6, color: BLACK },
              { row: 5, col: 2, color: BLACK }, { row: 5, col: 3, color: WHITE }, { row: 5, col: 4, color: WHITE }, { row: 5, col: 5, color: BLACK },
              { row: 6, col: 3, color: BLACK }, { row: 6, col: 4, color: BLACK },
            ], lastMove: { row: 3, col: 6, color: WHITE },
            caption: 'White connects. The group now has three liberties instead of two, the chase is broken, and every Black stone spent on it is wasted. Always read the ladder to its end before you start one.' },
        ],
      },
      {
        id: 'adv-direction', title: 'Direction of Play', type: 'walkthrough', boardSize: 13,
        steps: [
          { stones: [{ row: 3, col: 3, color: BLACK }, { row: 3, col: 9, color: WHITE }],
            caption: 'Strong groups don’t need help, and territory near them is small. So the question is never just “is this move big?” but “is it big in the right direction?”' },
          { stones: [{ row: 3, col: 3, color: BLACK }, { row: 3, col: 9, color: WHITE }, { row: 9, col: 3, color: BLACK }, { row: 6, col: 2, color: WHITE }], lastMove: { row: 6, col: 2, color: WHITE },
            caption: 'White plays between two Black corner stones — the side where Black most wants to expand. Taking your opponent’s biggest point is usually worth more than taking your own.' },
          { stones: [{ row: 3, col: 3, color: BLACK }, { row: 3, col: 9, color: WHITE }, { row: 9, col: 3, color: BLACK }, { row: 6, col: 2, color: WHITE }],
            caption: 'Play away from strength, toward the open board, and into the area both sides want. That instinct — direction — is what separates intermediate players from beginners who only see local fights.' },
        ],
      },
    ],
  },
  {
    id: 'example-games',
    title: 'Example Games',
    lessons: [
      // ---- 9x9 -------------------------------------------------------------
      // A complete game, played out until every boundary is closed. Verified
      // move by move against the engine: all 25 moves are legal, nothing is
      // captured, and the final position is fully sealed, scoring B 31 to
      // W 25 + 5.5 komi = 30.5.
      {
        id: 'game-9', title: 'A Full Game: 9×9', type: 'game', boardSize: 9, komi: 5.5,
        showFinalTerritory: true, finalScore: { black: 31, white: 30.5 },
        intro: 'A complete teaching game on 9×9, from the first stone to the final count — and it comes down to half a point. On a board this small the opening lasts about four moves, so almost everything is decided by where the boundaries end up. Step through and watch the border form.',
        moves: [
          M(2, 2, 'Black takes a corner star point. Corners are the cheapest territory on the board: you need stones on only two sides to enclose a corner, three for a side, and four for the middle.'),
          M(6, 6, 'White takes the opposite corner. There is nothing to fight about yet, so both players simply take the most valuable empty areas.'),
          M(6, 2, 'Black takes a second corner. Two corners on the same side means Black is claiming the whole left of the board.'),
          M(2, 6, 'White answers with the fourth corner and claims the right. Four moves in, the 9×9 opening is essentially over.'),
          M(4, 4, 'Tengen — the centre point. On a small board this is huge: it reaches toward both of Black’s corners at once and looks straight into White’s half.'),
          M(4, 6, 'White links his two corner stones into one solid position, and the right side starts to look like his.'),
          M(4, 2, 'Black does the same on the left. Both players now have a framework, and the game will be decided by exactly where the line between them falls.'),
          M(7, 4, 'White expands along the bottom, pushing the boundary toward Black’s side.'),
          M(1, 4, 'Black answers on the top. Neither player is attacking — they are racing to claim the neutral ground in the middle.'),
          M(6, 4, 'White pushes upward. Moves like this are worth only a point or two, but on 9×9 a point or two is a large fraction of the whole game.'),
          M(6, 3, 'Black blocks directly. Blocking here is right: it defends the lower-left corner and keeps White’s stones pressed low at the same time.'),
          M(5, 5, 'White caps diagonally, drawing the boundary he wants through the centre.'),
          M(5, 4, 'Black blocks, connecting underneath his centre stone. The border is now visible — a diagonal running from bottom-left to top-right.'),
          M(4, 5, 'White joins everything on the right into a single group. There are no cutting points left for Black to aim at.'),
          M(3, 5, 'Black hanes — reaching around the outside of White’s stone. The hane is one of the most useful shapes in Go: it pushes your border forward and holds your opponent’s back.'),
          M(3, 6, 'White blocks, protecting the top-right corner.'),
          M(2, 5, 'Black extends and seals the top. Both frameworks are now closed off; what remains is pure endgame.'),
          M(7, 3, 'White pushes into the bottom-left. The big areas are settled, so both players now trade small boundary points.'),
          M(7, 2, 'Black blocks.'),
          M(8, 3, 'White descends to the edge. This is solid — the stone connects back to his own, so Black cannot cut it off and capture it.'),
          M(8, 2, 'Black blocks and seals the corner. Notice how each of these exchanges is only worth a point or two, and how much that matters here.'),
          M(1, 6, 'White blocks on the top right — the last sizeable boundary left.'),
          M(1, 5, 'Black blocks back.'),
          M(0, 6, 'White descends to the top edge.'),
          M(0, 5, 'Black seals the very last open point. Every boundary is now closed, so both players pass and the game is counted.'),
        ],
        summary: 'Black has 31 points of territory; White has 25 plus 5.5 komi, for 30.5. Black wins by half a point. Not a single stone was captured all game — the entire result came from who claimed which points, and from a handful of one-point boundary exchanges at the end. That is 9×9 in a nutshell: the opening is over almost immediately, and the endgame decides everything. Step back through and pick any one boundary move; play it the other way, and Black loses.',
      },

      // ---- 13x13 -----------------------------------------------------------
      // A complete game built around the 3-3 invasion under a 4-4 stone.
      // Verified against the engine: all 67 moves legal, final position fully
      // sealed, scoring B 58 to W 45 + 6.5 komi = 51.5.
      //
      // The corner's exact shape matters here, not just its rough size. The
      // first version of this game stopped the corner exchange one move too
      // soon: six stones enclosing what looked like a clean 2x3 eye space,
      // which is alive when a solid block borders it on every side, but this
      // shape only borders it along an L, leaving two of the six points
      // reachable only through each other rather than through a White stone.
      // An exhaustive local search (every legal Black attack, every legal
      // White reply, using the real engine's capture/suicide rules) proved
      // Black could kill it outright. White's actual follow-up — one stone
      // at the shape's vital point — was verified the same way to make it
      // unconditionally alive. The lesson is folded into the commentary
      // below rather than removed: a shape that looks like a finished
      // corner joseki can still be one move short of actually living.
      {
        id: 'game-13', title: 'A Full Game: 13×13', type: 'game', boardSize: 13, komi: 6.5,
        showFinalTerritory: true, finalScore: { black: 58, white: 51.5 },
        // Regression guard for the exact bug described above: verify-lessons.js
        // exhaustively checks this group is genuinely unconditionally alive
        // (not just currently uncaptured) right after the vital-point move.
        lifeDeathChecks: [{ afterMove: 20, seed: { row: 2, col: 2 }, label: 'White corner group' }],
        intro: 'A complete teaching game on 13×13, built around the single most important trade in Go: territory now, or a wall that makes territory later. White invades a corner and lives there; Black lets him, and takes an outside wall in exchange. Watch what that wall is worth by the end.',
        moves: [
          M(3, 3, 'Black starts on a corner star point — the 4-4. A stone here claims the corner loosely while facing outward, toward the rest of the board.'),
          M(9, 9, 'White takes the opposite corner.'),
          M(9, 3, 'Black takes a second corner. With both left-hand corners, Black is thinking about the entire left side.'),
          M(3, 9, 'White answers with the fourth corner, claiming the right.'),
          M(6, 3, 'Black extends down the left side, linking his two corner stones. This is not territory yet — it is a framework, a large area loosely claimed.'),
          M(6, 9, 'White builds the mirror framework on the right. Dead even so far.'),
          M(6, 6, 'Black takes the centre. Now his framework is clearly the bigger one, and White has to do something about it.'),
          M(2, 2, 'White invades at the 3-3 point, underneath Black’s corner stone. This is the standard way to take a corner that a 4-4 stone only loosely holds: the 4-4 controls the outside, not the corner itself.'),
          M(3, 2, 'Black blocks underneath. This is the critical decision of the whole game. Black cannot keep both the corner and the outside, so he chooses: he blocks on the side that makes his wall face down the left, toward his own stones.'),
          M(2, 3, 'White pushes along the third line, taking corner territory.'),
          M(2, 4, 'Black blocks. Every push-and-block here trades a little corner territory to White for one more stone in Black’s wall.'),
          M(1, 3, 'White turns upward and begins sealing his corner shut.'),
          M(1, 4, 'Black blocks alongside.'),
          M(0, 3, 'White descends to the top edge. This closes his corner off with his own stones — which is exactly what turns the enclosed points into real territory rather than a shared, neutral area.'),
          M(0, 4, 'Black blocks on the edge.'),
          M(2, 1, 'White extends the other way along the third line, widening his base.'),
          M(3, 1, 'Black blocks, extending his wall.'),
          M(2, 0, 'White reaches the left edge, boxing in a six-point space in the corner.'),
          M(3, 0, 'Black blocks. The wall is complete — four stones facing straight down the board. The corner looks finished, and a beginner would happily tenuki here, but it is not actually alive yet: the six enclosed points share only four of them as real liberties of White’s chain, and Black has a move that starts killing the whole group. Don’t take a corner’s life for granted just because it looks like a familiar shape — read it out.'),
          M(1, 1, 'White reads the danger and plays the vital point. This single stone is the difference between a dead shape and a living one: it splits the corner into two separated spaces that Black can never connect back into one, which is exactly what two real eyes requires. Now, and only now, is the corner unconditionally alive.'),
          M(9, 1, 'Black has no reason to answer locally — attacking the corner is pointless now — so he takes the next-biggest point instead, reinforcing the framework his own wall points toward.'),
          M(9, 6, 'White reduces from the right, pressing into the lower part of Black’s framework.'),
          M(10, 6, 'Black blocks underneath, protecting the bottom — the direction his wall points.'),
          M(9, 7, 'White pushes on.'),
          M(10, 7, 'Black follows underneath. White gains a few points along row 9; Black seals the entire bottom. Black is happy with this.'),
          M(9, 8, 'White pushes again.'),
          M(10, 8, 'Black follows again, and the bottom is now firmly his.'),
          M(6, 7, 'White turns to the centre and pushes at Black’s tengen stone from the right.'),
          M(5, 7, 'Black blocks above, keeping White out of the upper centre.'),
          M(7, 7, 'White extends downward, heading toward the safety of his own stones.'),
          M(5, 8, 'Black extends too, drawing the boundary as he goes.'),
          M(8, 7, 'White connects his centre stones down to his group on row 9. They are now safe.'),
          M(7, 6, 'Black caps from the left. This is necessary, not optional: his centre stone was down to two liberties and would have come under attack.'),
          M(8, 6, 'White pushes left.'),
          M(8, 5, 'Black blocks.'),
          M(9, 5, 'White pushes left once more.'),
          M(9, 4, 'Black blocks, backed up by his corner stone. White’s advance stops here.'),
          M(3, 5, 'White switches to the top, sliding into the gap beneath Black’s wall.'),
          M(2, 5, 'Black blocks above. His wall along row 2 is what holds the whole top.'),
          M(3, 6, 'White pushes.'),
          M(2, 6, 'Black blocks.'),
          M(3, 7, 'White pushes.'),
          M(2, 7, 'Black blocks.'),
          M(3, 8, 'White pushes once more, joining all the way back to his top-right corner stone.'),
          M(2, 8, 'Black blocks. Two solid walls now face each other along rows 2 and 3.'),
          M(2, 9, 'White blocks Black’s wall from running any further right.'),
          M(1, 9, 'Black slides along row 1, reducing White’s corner from the top.'),
          M(1, 10, 'White blocks.'),
          M(0, 10, 'Black hanes on the very edge. First-line moves are small, but in a close endgame they decide games.'),
          M(0, 11, 'White blocks.'),
          M(0, 9, 'Black connects. Without this, his edge stone was in atari and would simply have been captured.'),
          M(6, 8, 'White fills the gap in his centre wall, removing a point where Black could have cut.'),
          M(3, 4, 'Black blocks White’s top wall from pushing any further left.'),
          M(4, 9, 'White seals the right-hand edge of his framework.'),
          M(4, 5, 'Black seals underneath White’s wall. From here on both players are simply drawing exact borders — this is the endgame.'),
          M(4, 6, 'White pushes down into a remaining gap.'),
          M(5, 6, 'Black blocks it off.'),
          M(5, 9, 'White seals.'),
          M(4, 7, 'Black seals.'),
          M(10, 9, 'White descends into the bottom-right corner, claiming it.'),
          M(4, 8, 'Black seals.'),
          M(11, 9, 'White descends again.'),
          M(10, 5, 'Black closes off White’s row-9 stones from below.'),
          M(12, 9, 'White descends to the last line, finishing his corner.'),
          M(11, 8, 'Black blocks alongside.'),
          PASS('White has no move left anywhere that gains him a point. Playing inside his own territory would only fill a point he already owns — under territory scoring that costs him a point. So he passes. Knowing when there is nothing left to play is part of the endgame.'),
          M(12, 8, 'Black fills the final boundary point. Both players now pass, and the game is counted.'),
        ],
        summary: 'Black has 58 points; White has 45 plus 6.5 komi, for 51.5. Black wins by 6.5. Now look back at moves 19–20. White took roughly six points of corner territory, but only became truly, unconditionally alive after the extra move at the vital point — the shape wasn’t finished the moment it looked finished. Black took a four-stone wall in exchange, and that wall is the reason Black’s bottom and left grew so large, and the reason White’s reductions along rows 3 and 9 never broke through anywhere. The trade — a small living corner against outside strength — is the main lesson here, but the smaller one matters too: check that a corner is actually alive before you rely on it, not just that it looks like one you’ve seen before.',
      },

      // ---- 19x19 -----------------------------------------------------------
      // An opening study, not a finished game: a real 19x19 game runs well
      // past 200 moves, and the lesson here is whole-board direction, which
      // is settled in the first 30. Deliberately has no showFinalTerritory —
      // nothing is sealed yet, so shading territory would imply a score that
      // does not exist. All 26 moves verified legal against the engine.
      {
        id: 'game-19', title: 'Opening Study: 19×19', type: 'game', boardSize: 19, komi: 6.5,
        intro: 'A full 19×19 game runs well over two hundred moves, so this study stops after the opening — which is where games at this size are usually decided anyway. There is no fighting in it at all. Watch instead how each move simply goes to the biggest open area, and how the two players draw a line across the whole board without ever capturing a stone.',
        moves: [
          M(3, 3, 'Black takes a corner. The order never changes with board size: corners first, then sides, then the centre.'),
          M(3, 15, 'White takes a corner of his own.'),
          M(15, 15, 'Black takes a third, diagonally opposite his first. A diagonal pair is flexible — Black is not yet committed to any one side of the board.'),
          M(15, 3, 'White takes the last corner. All four are claimed inside four moves; that is how much more valuable they are than anything else.'),
          M(3, 9, 'Black plays the top side, between his own corner stone and White’s. This move does two jobs at once — it extends Black’s position and denies White the same extension. Moves that work for you and against your opponent are the best moves available.'),
          M(15, 9, 'White does exactly the same along the bottom.'),
          M(9, 15, 'Black takes the right side.'),
          M(9, 3, 'White takes the left. The four sides and four corners are now shared evenly — and it is Black’s move.'),
          M(9, 9, 'Black takes the centre point. With everything else split down the middle, the last big open area is the middle, and Black gets it simply because he moved first. That is what the komi given to White is meant to compensate for.'),
          M(12, 6, 'White builds in the lower left, turning three loosely placed stones into a single large framework.'),
          M(12, 12, 'Black answers with a framework of his own in the lower right. Both players are now claiming big areas — but neither has any territory yet. A framework is a claim, not a possession.'),
          M(6, 16, 'White extends down the right side from his top-right corner.'),
          M(6, 6, 'Black extends in the top left. Both sides are still simply taking the largest remaining point instead of starting a fight.'),
          M(13, 9, 'The two frameworks now touch, and White begins pushing along the border between them. He could instead invade deep into Black’s area — but Black is strong on every side of it, so an invading group would struggle to live. Pushing along the boundary reduces Black safely.'),
          M(13, 10, 'Black blocks. Which side you block on is the entire question: this keeps the larger area on Black’s side of the line.'),
          M(12, 9, 'White pushes again.'),
          M(12, 10, 'Black blocks again.'),
          M(11, 9, 'White pushes.'),
          M(11, 10, 'Black blocks.'),
          M(10, 9, 'White pushes up to just underneath Black’s centre stone.'),
          M(10, 10, 'Black blocks. This exchange looks repetitive, but it has just drawn the most important line on the board: everything left of it leans White, everything right of it leans Black.'),
          M(16, 6, 'White reinforces the lower left, turning that framework into something much closer to actual territory.'),
          M(16, 14, 'Black does the same in the lower right.'),
          M(6, 12, 'White reduces the top, expanding from his corner toward the centre.'),
          M(6, 9, 'Black connects along row 6, joining his top-left stones and his centre into one continuous position. Solid, and it stops White’s reduction from going any deeper.'),
          M(3, 12, 'White seals the top boundary. The opening is over, and the shape of the whole board is set.'),
        ],
        summary: 'Nothing has been captured, and nothing is settled — no group here is alive or dead yet, and there is no score to count. But the board already has a clear shape: White holds the left and the bottom, Black holds the right and the centre, and the top is split between them. Notice what never happened. No invasions, no captures, no fights. Both players simply took the biggest open area again and again, and when the boundary finally mattered, they blocked on the side that kept more. That is what direction of play means, and on a board this size it decides far more games than tactics ever do.',
      },
    ],
  },
];
