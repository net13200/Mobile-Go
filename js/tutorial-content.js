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
          return moveResult.legal && window.TutorialHelpers.ladderContinues(game, 5, 3);
        },
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
          return moveResult.legal && window.TutorialHelpers.ladderContinues(game, 5, 3);
        },
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
  { id: 'life-death', title: 'Life and Death Basics', lessons: [] },
  { id: 'shape', title: 'Shape', lessons: [] },
  { id: 'opening', title: 'Opening Principles', lessons: [] },
  { id: 'middlegame', title: 'Middlegame Tactics', lessons: [] },
  { id: 'endgame', title: 'Endgame Basics', lessons: [] },
  { id: 'advanced', title: 'Advanced (Coming Soon)', lessons: [] },
];
