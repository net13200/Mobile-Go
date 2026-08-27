(function () {
  'use strict';

  const setupScreen = document.getElementById('setup-screen');
  const gameScreen = document.getElementById('game-screen');
  const sizeButtons = [...document.querySelectorAll('.size-btn')];
  const komiInput = document.getElementById('komi-input');
  const startBtn = document.getElementById('start-btn');
  const learnBtn = document.getElementById('learn-btn');

  const canvas = document.getElementById('board-canvas');
  const boardWrap = document.getElementById('board-wrap');
  const mainBoardView = createBoardView(canvas, { container: boardWrap });

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

  if (learnBtn) {
    learnBtn.addEventListener('click', () => {
      if (window.Tutorial) window.Tutorial.openLearnScreen();
    });
  }

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
      mainBoardView.resize(game.size);
      renderMain();
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

  window.addEventListener('resize', () => {
    if (game) {
      mainBoardView.resize(game.size);
      renderMain();
    }
  });

  function renderMain() {
    if (!game) return;
    mainBoardView.render(game, {
      showTerritory: game.scoringPhase || liveScoreVisible,
      showLastMove: !game.scoringPhase && !liveScoreVisible,
    });
  }

  // ---------- Input handling ----------

  mainBoardView.onIntersectionClick((row, col) => {
    if (!game || game.gameOver) return;

    if (game.scoringPhase) {
      game.toggleDeadGroup(row, col);
      renderMain();
      updateLiveScore();
      return;
    }

    const result = game.playMove(row, col);
    if (result.legal) {
      vibrate(10);
      renderMain();
      updateHud();
      updateLiveScorePanel();
    }
  });

  function vibrate(ms) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (_) { /* ignore */ }
  }

  // ---------- Controls ----------

  undoBtn.addEventListener('click', () => {
    if (!game) return;
    game.undo();
    mainBoardView.resize(game.size);
    renderMain();
    updateHud();
    updateLiveScorePanel();
  });

  passBtn.addEventListener('click', () => {
    if (!game || game.gameOver) return;
    game.pass();
    renderMain();
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
      mainBoardView.resize(game.size);
      renderMain();
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
    renderMain();
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
    renderMain();
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
