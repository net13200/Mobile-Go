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

// ---- Shared positions, so a shape used by several lessons is written once. ----

const B_ = (row, col) => ({ row, col, color: BLACK });
const W_ = (row, col) => ({ row, col, color: WHITE });

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
];
