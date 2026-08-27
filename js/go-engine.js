// Pure game logic for Go. No DOM access here.

const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

class GoGame {
  constructor(size, komi = 6.5) {
    this.size = size;
    this.komi = komi;
    this.board = new Array(size * size).fill(EMPTY);
    this.currentPlayer = BLACK;
    this.captures = { [BLACK]: 0, [WHITE]: 0 };
    this.passCount = 0;
    this.gameOver = false;
    this.winner = null;
    this.resignedBy = null;
    this.lastMove = null;
    this.moveLog = [];
    this.scoringPhase = false;
    this.deadStones = new Set();
    this.positionHistory = new Set();
    this.positionHistory.add(this._historyKey(this.board, this.currentPlayer));
  }

  index(row, col) {
    return row * this.size + col;
  }

  rowCol(i) {
    return [Math.floor(i / this.size), i % this.size];
  }

  _historyKey(board, player) {
    return board.join('') + '|' + player;
  }

  neighbors(i) {
    const { size } = this;
    const [r, c] = this.rowCol(i);
    const result = [];
    if (r > 0) result.push(i - size);
    if (r < size - 1) result.push(i + size);
    if (c > 0) result.push(i - 1);
    if (c < size - 1) result.push(i + 1);
    return result;
  }

  getGroup(board, i) {
    const color = board[i];
    const stones = new Set([i]);
    const liberties = new Set();
    const stack = [i];
    while (stack.length) {
      const cur = stack.pop();
      for (const n of this.neighbors(cur)) {
        if (board[n] === EMPTY) {
          liberties.add(n);
        } else if (board[n] === color && !stones.has(n)) {
          stones.add(n);
          stack.push(n);
        }
      }
    }
    return { stones, liberties };
  }

  _snapshot() {
    return {
      board: [...this.board],
      currentPlayer: this.currentPlayer,
      captures: { ...this.captures },
      passCount: this.passCount,
      lastMove: this.lastMove,
      positionHistory: new Set(this.positionHistory),
    };
  }

  playMove(row, col) {
    if (this.gameOver || this.scoringPhase) {
      return { legal: false, reason: 'inactive' };
    }
    const i = this.index(row, col);
    if (this.board[i] !== EMPTY) {
      return { legal: false, reason: 'occupied' };
    }

    const color = this.currentPlayer;
    const opponent = color === BLACK ? WHITE : BLACK;
    const testBoard = [...this.board];
    testBoard[i] = color;

    let capturedStones = [];
    const checkedGroups = new Set();
    for (const n of this.neighbors(i)) {
      if (testBoard[n] === opponent && !checkedGroups.has(n)) {
        const group = this.getGroup(testBoard, n);
        for (const s of group.stones) checkedGroups.add(s);
        if (group.liberties.size === 0) {
          capturedStones.push(...group.stones);
        }
      }
    }
    for (const s of capturedStones) testBoard[s] = EMPTY;

    const myGroup = this.getGroup(testBoard, i);
    if (myGroup.liberties.size === 0) {
      return { legal: false, reason: 'suicide' };
    }

    const newKey = this._historyKey(testBoard, opponent);
    if (this.positionHistory.has(newKey)) {
      return { legal: false, reason: 'ko' };
    }

    this.moveLog.push(this._snapshot());
    this.board = testBoard;
    this.captures[color] += capturedStones.length;
    this.currentPlayer = opponent;
    this.passCount = 0;
    this.lastMove = { row, col, color };
    this.positionHistory.add(newKey);

    return { legal: true, captured: capturedStones.length };
  }

  pass() {
    if (this.gameOver || this.scoringPhase) return;
    this.moveLog.push(this._snapshot());
    this.passCount++;
    this.lastMove = null;
    this.currentPlayer = this.currentPlayer === BLACK ? WHITE : BLACK;
    this.positionHistory.add(this._historyKey(this.board, this.currentPlayer));
    if (this.passCount >= 2) {
      this.scoringPhase = true;
    }
  }

  undo() {
    if (this.moveLog.length === 0) return false;
    const snap = this.moveLog.pop();
    this.board = snap.board;
    this.currentPlayer = snap.currentPlayer;
    this.captures = snap.captures;
    this.passCount = snap.passCount;
    this.lastMove = snap.lastMove;
    this.positionHistory = snap.positionHistory;
    this.scoringPhase = false;
    this.deadStones.clear();
    return true;
  }

  loadPosition(stones, toPlay = BLACK) {
    this.board.fill(EMPTY);
    for (const { row, col, color } of stones) {
      this.board[this.index(row, col)] = color;
    }
    this.currentPlayer = toPlay;
    this.captures = { [BLACK]: 0, [WHITE]: 0 };
    this.passCount = 0;
    this.gameOver = false;
    this.winner = null;
    this.resignedBy = null;
    this.lastMove = null;
    this.moveLog = [];
    this.scoringPhase = false;
    this.deadStones = new Set();
    this.positionHistory = new Set();
    this.positionHistory.add(this._historyKey(this.board, this.currentPlayer));
    return this;
  }

  resign(color) {
    this.gameOver = true;
    this.resignedBy = color;
    this.winner = color === BLACK ? WHITE : BLACK;
  }

  toggleDeadGroup(row, col) {
    if (!this.scoringPhase) return;
    const i = this.index(row, col);
    if (this.board[i] === EMPTY) return;
    const group = this.getGroup(this.board, i);
    const anyDead = [...group.stones].some((s) => this.deadStones.has(s));
    if (anyDead) {
      for (const s of group.stones) this.deadStones.delete(s);
    } else {
      for (const s of group.stones) this.deadStones.add(s);
    }
  }

  resumePlay() {
    this.scoringPhase = false;
    this.passCount = 0;
    this.deadStones.clear();
  }

  computeScore() {
    // Japanese-style territory scoring: territory (empty points surrounded
    // by one color) + prisoners. A dead stone counts twice for the
    // capturing side: once as a prisoner, once as the territory it vacates.
    const effectiveBoard = [...this.board];
    let deadBlack = 0;
    let deadWhite = 0;
    for (const d of this.deadStones) {
      if (this.board[d] === BLACK) deadBlack++;
      else if (this.board[d] === WHITE) deadWhite++;
      effectiveBoard[d] = EMPTY;
    }

    const territory = { [BLACK]: 0, [WHITE]: 0 };
    const visited = new Array(effectiveBoard.length).fill(false);
    for (let idx = 0; idx < effectiveBoard.length; idx++) {
      if (effectiveBoard[idx] === EMPTY && !visited[idx]) {
        const region = [idx];
        visited[idx] = true;
        const borders = new Set();
        let qi = 0;
        while (qi < region.length) {
          const cur = region[qi++];
          for (const n of this.neighbors(cur)) {
            if (effectiveBoard[n] === EMPTY) {
              if (!visited[n]) {
                visited[n] = true;
                region.push(n);
              }
            } else {
              borders.add(effectiveBoard[n]);
            }
          }
        }
        if (borders.size === 1) {
          const owner = [...borders][0];
          territory[owner] += region.length;
        }
      }
    }

    const blackPrisoners = this.captures[BLACK] + deadWhite;
    const whitePrisoners = this.captures[WHITE] + deadBlack;

    const blackScore = territory[BLACK] + blackPrisoners;
    const whiteScore = territory[WHITE] + whitePrisoners + this.komi;
    return {
      blackScore,
      whiteScore,
      blackTerritory: territory[BLACK],
      whiteTerritory: territory[WHITE],
      blackPrisoners,
      whitePrisoners,
      winner: blackScore > whiteScore ? BLACK : WHITE,
      diff: Math.abs(blackScore - whiteScore),
    };
  }
}
