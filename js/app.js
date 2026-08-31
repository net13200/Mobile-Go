(function () {
  'use strict';

  const setupScreen = document.getElementById('setup-screen');
  const gameScreen = document.getElementById('game-screen');
  const sizeButtons = [...document.querySelectorAll('.size-btn')];
  const komiInput = document.getElementById('komi-input');
  const startBtn = document.getElementById('start-btn');
  const learnBtn = document.getElementById('learn-btn');
  const versionBtn = document.getElementById('version-btn');
  const whatsNewScreen = document.getElementById('whats-new-screen');
  const whatsNewBackBtn = document.getElementById('whats-new-back-btn');
  const whatsNewList = document.getElementById('whats-new-list');

  const opponentButtons = [...document.querySelectorAll('.opt-btn[data-opponent]')];
  const colorButtons = [...document.querySelectorAll('.opt-btn[data-color]')];
  const difficultyButtons = [...document.querySelectorAll('.opt-btn[data-difficulty]')];
  const aiOptions = document.getElementById('ai-options');
  const handicapSelect = document.getElementById('handicap-select');

  const spectateOptions = document.getElementById('spectate-options');
  const spectateDiffButtons = [...document.querySelectorAll('.opt-btn[data-spectate-difficulty]')];
  const spectateControls = document.getElementById('spectate-controls');
  const spectatePauseBtn = document.getElementById('spectate-pause-btn');
  const spectateStepBtn = document.getElementById('spectate-step-btn');
  const spectateSpeedSelect = document.getElementById('spectate-speed-select');

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

  // Computer opponent state. aiColor is null in a two-player game.
  let vsComputer = false;
  let playerColor = BLACK;
  let aiColor = null;
  let handicap = 0;
  let aiDifficulty = 'easy';
  let aiThinking = false;
  let aiTimer = null;

  // Spectate ("AI vs AI") state. spectateSelected mirrors vsComputer's role
  // at setup time; spectating is the per-game value captured at start,
  // exactly like aiColor is derived from playerColor in startGame().
  let spectateSelected = false;
  let spectating = false;
  let spectateBlackDifficulty = 'easy';
  let spectateWhiteDifficulty = 'easy';
  let spectatePaused = false;
  let spectateStepOnce = false; // advance exactly one move, then re-pause
  let spectateSpeedMultiplier = 1;

  // Easy answers in ~8ms, so its full delay is an artificial pause to feel
  // considered. Medium's own search already takes real time (tens to a
  // couple hundred ms), so it gets a shorter pause on top rather than
  // stacking the full delay on top of a wait that's already perceptible.
  const AI_DELAY_MS = { easy: 350, medium: 150 };

  // ---------- Setup screen ----------

  sizeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      sizeButtons.forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedSize = parseInt(btn.dataset.size, 10);
      startBtn.disabled = false;
    });
  });

  opponentButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      opponentButtons.forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      const opponent = btn.dataset.opponent;
      vsComputer = opponent === 'ai';
      spectateSelected = opponent === 'spectate';
      aiOptions.classList.toggle('hidden', !vsComputer);
      spectateOptions.classList.toggle('hidden', !spectateSelected);
      if (!vsComputer) {
        handicapSelect.value = '0';
        handicap = 0;
        komiInput.value = '6.5';
      }
      if (opponent === 'human') {
        difficultyButtons.forEach((b) => b.classList.toggle('selected', b.dataset.difficulty === 'easy'));
        aiDifficulty = 'easy';
      }
    });
  });

  spectateDiffButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.spectateColor;
      spectateDiffButtons
        .filter((b) => b.dataset.spectateColor === color)
        .forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      if (color === 'black') spectateBlackDifficulty = btn.dataset.spectateDifficulty;
      else spectateWhiteDifficulty = btn.dataset.spectateDifficulty;
    });
  });

  spectateSpeedSelect.addEventListener('change', () => {
    spectateSpeedMultiplier = parseFloat(spectateSpeedSelect.value) || 1;
  });

  colorButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      colorButtons.forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      playerColor = btn.dataset.color === 'white' ? WHITE : BLACK;
    });
  });

  difficultyButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      difficultyButtons.forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      aiDifficulty = btn.dataset.difficulty;
    });
  });

  handicapSelect.addEventListener('change', () => {
    handicap = parseInt(handicapSelect.value, 10) || 0;
    // Handicap games traditionally use a token komi instead of the full 6.5,
    // since Black's compensation is the head start itself.
    komiInput.value = handicap > 0 ? '0.5' : '6.5';
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

  // ---------- Version / What's New ----------

  if (typeof APP_VERSION !== 'undefined') {
    versionBtn.textContent = 'Version ' + APP_VERSION;
  }

  versionBtn.addEventListener('click', () => {
    renderWhatsNew();
    setupScreen.classList.remove('active');
    whatsNewScreen.classList.add('active');
  });

  whatsNewBackBtn.addEventListener('click', () => {
    whatsNewScreen.classList.remove('active');
    setupScreen.classList.add('active');
  });

  function renderWhatsNew() {
    if (typeof RELEASE_NOTES === 'undefined') return;
    whatsNewList.innerHTML = '';
    for (const release of RELEASE_NOTES) {
      const entry = document.createElement('div');
      entry.className = 'release-entry';

      const heading = document.createElement('h3');
      heading.textContent = 'v' + release.version;
      entry.appendChild(heading);

      const date = document.createElement('p');
      date.className = 'release-date';
      date.textContent = release.date;
      entry.appendChild(date);

      const list = document.createElement('ul');
      for (const note of release.notes) {
        const item = document.createElement('li');
        item.textContent = note;
        list.appendChild(item);
      }
      entry.appendChild(list);

      whatsNewList.appendChild(entry);
    }
  }

  function startGame(size, komi) {
    game = new GoGame(size, komi);
    spectating = spectateSelected;
    aiColor = vsComputer ? (playerColor === BLACK ? WHITE : BLACK) : null;
    spectatePaused = false;
    spectateStepOnce = false;
    cancelPendingAI();

    // Handicap: Black's stones go down first and White opens the game.
    if (handicap > 0) {
      const stones = GoAI.handicapPoints(size, handicap);
      if (stones.length) game.loadPosition(stones, WHITE);
    }

    setupScreen.classList.remove('active');
    gameScreen.classList.add('active');
    resultModal.classList.add('hidden');
    scoringBanner.classList.add('hidden');
    document.getElementById('game-controls').classList.toggle('hidden', spectating);
    spectateControls.classList.toggle('hidden', !spectating);
    liveScoreVisible = false;
    liveScorePanel.classList.add('hidden');
    scoreToggleBtn.classList.remove('active');
    requestAnimationFrame(() => {
      mainBoardView.resize(game.size);
      renderMain();
      updateHud();
      maybeStartAITurn();
    });
  }

  // ---------- Computer opponent ----------

  function isAITurn() {
    return !!game && !game.gameOver && !game.scoringPhase &&
      (spectating || (aiColor !== null && game.currentPlayer === aiColor));
  }

  // In spectate mode both sides are AI, each with its own difficulty; in
  // vs-computer mode there's one fixed difficulty for the single AI seat.
  function currentAiDifficulty() {
    if (spectating) return game.currentPlayer === BLACK ? spectateBlackDifficulty : spectateWhiteDifficulty;
    return aiDifficulty;
  }

  function cancelPendingAI() {
    if (aiTimer !== null) { clearTimeout(aiTimer); aiTimer = null; }
    aiThinking = false;
  }

  function maybeStartAITurn() {
    if (!isAITurn() || aiThinking) return;
    // Paused spectating waits for Resume or a single Step, not a timer.
    if (spectating && spectatePaused && !spectateStepOnce) return;

    aiThinking = true;
    updateHud();
    const difficulty = currentAiDifficulty();
    const baseDelay = AI_DELAY_MS[difficulty];
    // Spectating has its own speed control layered on top of the same
    // per-difficulty base delay used for a human's opponent.
    const delay = spectating ? Math.max(30, Math.round(baseDelay * spectateSpeedMultiplier)) : baseDelay;

    aiTimer = setTimeout(() => {
      aiTimer = null;
      // The game may have been abandoned or undone while we waited.
      if (!isAITurn()) { aiThinking = false; updateHud(); return; }

      const chooseFn = difficulty === 'medium' ? GoAI.chooseMediumMove : GoAI.chooseMove;
      const color = game.currentPlayer;
      const move = chooseFn(game, color);
      if (move === null) {
        game.pass();
      } else {
        const result = game.playMove(move.row, move.col);
        // chooseMove screens for superko, but never trust it blindly: if the
        // engine rejects the move, passing is always legal and safe.
        if (!result.legal) game.pass();
      }

      aiThinking = false;
      renderMain();
      updateHud();
      updateLiveScorePanel();

      if (game.scoringPhase) {
        // A spectated game has no human to mark dead groups, and both AIs
        // only ever pass once the position is already tactically settled
        // (see go-ai.js's pass logic) — so score it immediately rather than
        // showing a "tap groups to mark them dead" banner nobody can use.
        if (spectating) {
          finishScoring();
        } else {
          scoringBanner.classList.remove('hidden');
          updateLiveScore();
        }
      } else if (spectating && spectateStepOnce) {
        spectateStepOnce = false;
        spectatePaused = true;
        updateHud();
      } else {
        // No-op for vs-computer (isAITurn() is now false, it's the human's
        // turn) — this is what actually drives spectate mode's second AI
        // seat to keep moving without any external trigger.
        maybeStartAITurn();
      }
    }, delay);
  }

  function backToSetup() {
    const confirmed = !game || game.gameOver || game.moveLog.length === 0 ||
      window.confirm('End the current game and return to setup?');
    if (!confirmed) return;
    cancelPendingAI();
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
    if (spectating) return; // spectator board is never clickable
    if (aiThinking || isAITurn()) return; // not your turn

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
      maybeStartAITurn();
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
    cancelPendingAI();
    game.undo();
    // Against the computer, take back its reply too so the board returns to
    // the player's own turn rather than handing them the AI's position.
    if (aiColor !== null && game.currentPlayer === aiColor) game.undo();
    mainBoardView.resize(game.size);
    renderMain();
    updateHud();
    updateLiveScorePanel();
  });

  passBtn.addEventListener('click', () => {
    if (!game || game.gameOver) return;
    if (aiThinking || isAITurn()) return;
    game.pass();
    renderMain();
    updateHud();
    updateLiveScorePanel();
    if (game.scoringPhase) {
      scoringBanner.classList.remove('hidden');
      updateLiveScore();
    } else {
      maybeStartAITurn();
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
    game.finalScore = null; // app-level field; stale from a previous Finish Scoring
    scoringBanner.classList.add('hidden');
    renderMain();
    updateHud();
    updateLiveScorePanel();
    maybeStartAITurn();
  });

  function finishScoring() {
    if (!game) return;
    const score = game.computeScore();
    game.gameOver = true;
    game.scoringPhase = false;
    game.winner = score.winner;
    game.finalScore = score;
    showResult();
  }

  finishScoringBtn.addEventListener('click', finishScoring);

  spectatePauseBtn.addEventListener('click', () => {
    if (!spectating || !game || game.gameOver) return;
    spectatePaused = !spectatePaused;
    if (spectatePaused) cancelPendingAI();
    else maybeStartAITurn();
    updateHud();
  });

  spectateStepBtn.addEventListener('click', () => {
    if (!spectating || !game || !spectatePaused || aiThinking) return;
    spectateStepOnce = true;
    maybeStartAITurn();
  });

  keepReviewingBtn.addEventListener('click', () => {
    resultModal.classList.add('hidden');
  });

  playAgainBtn.addEventListener('click', () => {
    resultModal.classList.add('hidden');
    backToSetupForce();
  });

  function backToSetupForce() {
    cancelPendingAI();
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
    } else if (spectating) {
      const diffLabel = currentAiDifficulty() === 'medium' ? 'Medium' : 'Easy';
      const colorName = isBlack ? 'Black' : 'White';
      if (spectatePaused) turnText.textContent = `Paused — ${colorName} (${diffLabel}) to move`;
      else if (aiThinking) turnText.textContent = `${colorName} (${diffLabel}) thinking…`;
      else turnText.textContent = `${colorName} (${diffLabel}) to move`;
    } else if (aiThinking) {
      turnText.textContent = 'Computer thinking…';
    } else if (aiColor !== null) {
      turnText.textContent = game.currentPlayer === aiColor ? 'Computer’s move' : 'Your move';
    } else {
      turnText.textContent = (isBlack ? 'Black' : 'White') + ' to move';
    }
    capturesBlackEl.textContent = game.captures[BLACK];
    capturesWhiteEl.textContent = game.captures[WHITE];

    const awaitingAI = aiThinking || isAITurn();
    undoBtn.disabled = game.moveLog.length === 0 || game.gameOver || awaitingAI;
    passBtn.disabled = game.gameOver || game.scoringPhase || awaitingAI;
    resignBtn.disabled = game.gameOver;

    if (spectating) {
      spectatePauseBtn.textContent = spectatePaused ? 'Resume' : 'Pause';
      spectatePauseBtn.disabled = game.gameOver;
      spectateStepBtn.disabled = game.gameOver || game.scoringPhase || !spectatePaused || aiThinking;
    }

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
