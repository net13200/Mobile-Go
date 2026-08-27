(function () {
  'use strict';

  const setupScreen = document.getElementById('setup-screen');
  const gameScreen = document.getElementById('game-screen');
  const sizeButtons = [...document.querySelectorAll('.size-btn')];
  const komiInput = document.getElementById('komi-input');
  const startBtn = document.getElementById('start-btn');

  const canvas = document.getElementById('board-canvas');
  const ctx = canvas.getContext('2d');
  const boardWrap = document.getElementById('board-wrap');

  const turnStone = document.getElementById('turn-stone');
  const turnText = document.getElementById('turn-text');
  const capturesBlackEl = document.getElementById('captures-black');
  const capturesWhiteEl = document.getElementById('captures-white');

  const undoBtn = document.getElementById('undo-btn');
  const passBtn = document.getElementById('pass-btn');
  const resignBtn = document.getElementById('resign-btn');
  const menuBtn = document.getElementById('menu-btn');

  const scoringBanner = document.getElementById('scoring-banner');
  const resumeBtn = document.getElementById('resume-btn');
  const finishScoringBtn = document.getElementById('finish-scoring-btn');
  const liveScoreBlack = document.getElementById('live-score-black');
  const liveScoreWhite = document.getElementById('live-score-white');
  const liveDetailBlack = document.getElementById('live-detail-black');
  const liveDetailWhite = document.getElementById('live-detail-white');

  const scoreToggleBtn = document.getElementById('score-toggle-btn');
  const liveScorePanel = document.getElementById('live-score-panel');
  const liveScoreBlackPanel = document.getElementById('live-score-black-panel');
  const liveScoreWhitePanel = document.getElementById('live-score-white-panel');
  const liveDetailBlackPanel = document.getElementById('live-detail-black-panel');
  const liveDetailWhitePanel = document.getElementById('live-detail-white-panel');

  const resultModal = document.getElementById('result-modal');
  const resultTitle = document.getElementById('result-title');
  const resultDetail = document.getElementById('result-detail');
  const keepReviewingBtn = document.getElementById('keep-reviewing-btn');
  const playAgainBtn = document.getElementById('play-again-btn');

  let game = null;
  let selectedSize = null;
  let cellPx = 0;
  let marginPx = 0;
  let dpr = Math.max(window.devicePixelRatio || 1, 1);
  let liveScoreVisible = false;

  // ---------- Setup screen ----------

  sizeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      sizeButtons.forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedSize = parseInt(btn.dataset.size, 10);
      startBtn.disabled = false;
    });
  });

  startBtn.addEventListener('click', () => {
    if (!selectedSize) return;
    let komi = parseFloat(komiInput.value);
    if (Number.isNaN(komi) || komi < 0) komi = 6.5;
    startGame(selectedSize, komi);
  });

  function startGame(size, komi) {
    game = new GoGame(size, komi);
    setupScreen.classList.remove('active');
    gameScreen.classList.add('active');
    resultModal.classList.add('hidden');
    scoringBanner.classList.add('hidden');
    document.getElementById('game-controls').classList.remove('hidden');
    liveScoreVisible = false;
    liveScorePanel.classList.add('hidden');
    scoreToggleBtn.classList.remove('active');
    requestAnimationFrame(() => {
      resizeCanvas();
      render();
      updateHud();
    });
  }

  function backToSetup() {
    const confirmed = !game || game.gameOver || game.moveLog.length === 0 ||
      window.confirm('End the current game and return to setup?');
    if (!confirmed) return;
    game = null;
    gameScreen.classList.remove('active');
    setupScreen.classList.add('active');
    resultModal.classList.add('hidden');
  }

  menuBtn.addEventListener('click', backToSetup);

  // ---------- Canvas sizing ----------

  function resizeCanvas() {
    if (!game) return;
    const rect = boardWrap.getBoundingClientRect();
    const available = Math.max(Math.min(rect.width, rect.height) - 4, 100);
    const size = game.size;
    // margin as a fraction of a cell, so labels/edge stones have room
    const cells = size - 1;
    cellPx = available / (cells + 1.4);
    marginPx = cellPx * 0.7;
    const boardPx = Math.round(cells * cellPx + marginPx * 2);

    canvas.style.width = boardPx + 'px';
    canvas.style.height = boardPx + 'px';
    canvas.width = Math.round(boardPx * dpr);
    canvas.height = Math.round(boardPx * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener('resize', () => {
    if (game) {
      resizeCanvas();
      render();
    }
  });

  // ---------- Rendering ----------

  const STAR_POINTS = {
    9: [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]],
    13: [[3, 3], [3, 9], [9, 3], [9, 9], [6, 6]],
    19: [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]],
  };

  function boardToPx(row, col) {
    return {
      x: marginPx + col * cellPx,
      y: marginPx + row * cellPx,
    };
  }

  function render() {
    if (!game) return;
    const size = game.size;
    const boardPx = marginPx * 2 + (size - 1) * cellPx;

    ctx.clearRect(0, 0, boardPx, boardPx);

    // wood background
    const grad = ctx.createLinearGradient(0, 0, boardPx, boardPx);
    grad.addColorStop(0, getVar('--board-wood-light'));
    grad.addColorStop(1, getVar('--board-wood'));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, boardPx, boardPx);

    // grid lines
    ctx.strokeStyle = getVar('--board-line');
    ctx.lineWidth = Math.max(cellPx * 0.045, 1);
    ctx.lineCap = 'square';
    for (let i = 0; i < size; i++) {
      const a = boardToPx(i, 0);
      const b = boardToPx(i, size - 1);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      const c = boardToPx(0, i);
      const d = boardToPx(size - 1, i);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
    }

    // star points
    const stars = STAR_POINTS[size] || [];
    ctx.fillStyle = getVar('--board-line');
    for (const [r, c] of stars) {
      const p = boardToPx(r, c);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(cellPx * 0.09, 2), 0, Math.PI * 2);
      ctx.fill();
    }

    // stones
    const stoneRadius = cellPx * 0.46;
    for (let idx = 0; idx < game.board.length; idx++) {
      const color = game.board[idx];
      if (color === EMPTY) continue;
      const [r, c] = game.rowCol(idx);
      const p = boardToPx(r, c);
      drawStone(p.x, p.y, stoneRadius, color, game.deadStones.has(idx));
    }

    // last move marker
    if (game.lastMove && !game.scoringPhase) {
      const p = boardToPx(game.lastMove.row, game.lastMove.col);
      ctx.beginPath();
      ctx.arc(p.x, p.y, stoneRadius * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = game.lastMove.color === BLACK ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.75)';
      ctx.fill();
    }

    // scoring overlay: territory preview
    if (game.scoringPhase) {
      drawTerritoryPreview(stoneRadius);
    }
  }

  function drawStone(x, y, radius, color, isDead) {
    ctx.save();
    if (isDead) ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    let grad;
    if (color === BLACK) {
      grad = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.35, radius * 0.1, x, y, radius);
      grad.addColorStop(0, getVar('--black-stone-a'));
      grad.addColorStop(1, getVar('--black-stone-b'));
    } else {
      grad = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.35, radius * 0.1, x, y, radius);
      grad.addColorStop(0, getVar('--white-stone-a'));
      grad.addColorStop(1, getVar('--white-stone-b'));
    }
    ctx.fillStyle = grad;
    ctx.fill();
    if (color === WHITE) {
      ctx.lineWidth = Math.max(radius * 0.06, 0.5);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.stroke();
    }
    if (isDead) {
      ctx.strokeStyle = color === BLACK ? '#fff' : '#900';
      ctx.lineWidth = Math.max(radius * 0.18, 1.5);
      const s = radius * 0.5;
      ctx.beginPath();
      ctx.moveTo(x - s, y - s);
      ctx.lineTo(x + s, y + s);
      ctx.moveTo(x + s, y - s);
      ctx.lineTo(x - s, y + s);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTerritoryPreview(stoneRadius) {
    const size = game.size;
    const effectiveBoard = [...game.board];
    for (const d of game.deadStones) effectiveBoard[d] = EMPTY;

    const visited = new Array(effectiveBoard.length).fill(false);
    for (let idx = 0; idx < effectiveBoard.length; idx++) {
      if (effectiveBoard[idx] === EMPTY && !visited[idx]) {
        const region = [idx];
        visited[idx] = true;
        const borders = new Set();
        let qi = 0;
        while (qi < region.length) {
          const cur = region[qi++];
          for (const n of game.neighbors(cur)) {
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
          ctx.fillStyle = owner === BLACK ? 'rgba(20,20,20,0.55)' : 'rgba(255,255,255,0.75)';
          for (const cellIdx of region) {
            const [r, c] = game.rowCol(cellIdx);
            const p = boardToPx(r, c);
            ctx.beginPath();
            ctx.arc(p.x, p.y, stoneRadius * 0.28, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }

  function getVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // ---------- Input handling ----------

  canvas.addEventListener('click', (e) => {
    if (!game || game.gameOver) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.round((x - marginPx) / cellPx);
    const row = Math.round((y - marginPx) / cellPx);
    if (row < 0 || row >= game.size || col < 0 || col >= game.size) return;

    const p = boardToPx(row, col);
    const dist = Math.hypot(x - p.x, y - p.y);
    if (dist > cellPx * 0.5) return;

    if (game.scoringPhase) {
      game.toggleDeadGroup(row, col);
      render();
      updateLiveScore();
      return;
    }

    const result = game.playMove(row, col);
    if (result.legal) {
      vibrate(10);
      render();
      updateHud();
      updateLiveScorePanel();
    }
  }, { passive: true });

  function vibrate(ms) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (_) { /* ignore */ }
  }

  // ---------- Controls ----------

  undoBtn.addEventListener('click', () => {
    if (!game) return;
    game.undo();
    resizeCanvas();
    render();
    updateHud();
    updateLiveScorePanel();
  });

  passBtn.addEventListener('click', () => {
    if (!game || game.gameOver) return;
    game.pass();
    render();
    updateHud();
    updateLiveScorePanel();
    if (game.scoringPhase) {
      scoringBanner.classList.remove('hidden');
      updateLiveScore();
    }
  });

  function renderScoreInto(elBlack, elWhite, elDetailBlack, elDetailWhite) {
    if (!game) return;
    const s = game.computeScore();
    elBlack.textContent = s.blackScore.toFixed(1);
    elWhite.textContent = s.whiteScore.toFixed(1);
    elDetailBlack.textContent = `${s.blackTerritory} terr + ${s.blackPrisoners} pris`;
    elDetailWhite.textContent = `${s.whiteTerritory} terr + ${s.whitePrisoners} pris + ${game.komi} komi`;
  }

  function updateLiveScore() {
    renderScoreInto(liveScoreBlack, liveScoreWhite, liveDetailBlack, liveDetailWhite);
  }

  function updateLiveScorePanel() {
    if (!liveScoreVisible) return;
    renderScoreInto(liveScoreBlackPanel, liveScoreWhitePanel, liveDetailBlackPanel, liveDetailWhitePanel);
  }

  scoreToggleBtn.addEventListener('click', () => {
    if (!game) return;
    liveScoreVisible = !liveScoreVisible;
    liveScorePanel.classList.toggle('hidden', !liveScoreVisible);
    scoreToggleBtn.classList.toggle('active', liveScoreVisible);
    if (liveScoreVisible) updateLiveScorePanel();
    requestAnimationFrame(() => {
      resizeCanvas();
      render();
    });
  });

  resignBtn.addEventListener('click', () => {
    if (!game || game.gameOver) return;
    const player = game.currentPlayer === BLACK ? 'Black' : 'White';
    if (!window.confirm(`${player} resigns. Are you sure?`)) return;
    game.resign(game.currentPlayer);
    showResult();
  });

  resumeBtn.addEventListener('click', () => {
    if (!game) return;
    game.resumePlay();
    scoringBanner.classList.add('hidden');
    render();
    updateHud();
    updateLiveScorePanel();
  });

  finishScoringBtn.addEventListener('click', () => {
    if (!game) return;
    const score = game.computeScore();
    game.gameOver = true;
    game.winner = score.winner;
    game.finalScore = score;
    showResult();
  });

  keepReviewingBtn.addEventListener('click', () => {
    resultModal.classList.add('hidden');
  });

  playAgainBtn.addEventListener('click', () => {
    resultModal.classList.add('hidden');
    backToSetupForce();
  });

  function backToSetupForce() {
    game = null;
    gameScreen.classList.remove('active');
    setupScreen.classList.add('active');
  }

  function showResult() {
    render();
    updateHud();
    if (game.resignedBy) {
      const winnerName = game.winner === BLACK ? 'Black' : 'White';
      const loserName = game.resignedBy === BLACK ? 'Black' : 'White';
      resultTitle.textContent = `${winnerName} wins`;
      resultDetail.textContent = `${loserName} resigned.`;
    } else if (game.finalScore) {
      const s = game.finalScore;
      const winnerName = s.winner === BLACK ? 'Black' : 'White';
      resultTitle.textContent = `${winnerName} wins by ${s.diff.toFixed(1)}`;
      resultDetail.textContent =
        `Black: ${s.blackScore.toFixed(1)} (${s.blackTerritory} terr + ${s.blackPrisoners} pris)\n` +
        `White: ${s.whiteScore.toFixed(1)} (${s.whiteTerritory} terr + ${s.whitePrisoners} pris + ${game.komi} komi)`;
    }
    resultModal.classList.remove('hidden');
  }

  // ---------- HUD ----------

  function updateHud() {
    if (!game) return;
    const isBlack = game.currentPlayer === BLACK;
    turnStone.className = 'stone-icon ' + (isBlack ? 'black' : 'white');
    if (game.gameOver) {
      turnText.textContent = 'Game over';
    } else if (game.scoringPhase) {
      turnText.textContent = 'Scoring';
    } else {
      turnText.textContent = (isBlack ? 'Black' : 'White') + ' to move';
    }
    capturesBlackEl.textContent = game.captures[BLACK];
    capturesWhiteEl.textContent = game.captures[WHITE];

    undoBtn.disabled = game.moveLog.length === 0 || game.gameOver;
    passBtn.disabled = game.gameOver || game.scoringPhase;
    resignBtn.disabled = game.gameOver;

    if (game.scoringPhase) {
      scoringBanner.classList.remove('hidden');
      scoreToggleBtn.disabled = true;
      liveScorePanel.classList.add('hidden');
    } else {
      scoringBanner.classList.add('hidden');
      scoreToggleBtn.disabled = game.gameOver;
      liveScorePanel.classList.toggle('hidden', !liveScoreVisible);
    }
  }
})();
