(function () {
  'use strict';

  const learnScreen = document.getElementById('learn-screen');
  const lessonScreen = document.getElementById('lesson-screen');
  const learnBackBtn = document.getElementById('learn-back-btn');
  const lessonListEl = document.getElementById('lesson-list');

  const lessonExitBtn = document.getElementById('lesson-exit-btn');
  const lessonProgressEl = document.getElementById('lesson-progress');
  const lessonCanvas = document.getElementById('lesson-canvas');
  const lessonBoardWrap = document.getElementById('lesson-board-wrap');
  const lessonCaptionEl = document.getElementById('lesson-caption');
  const lessonFeedbackEl = document.getElementById('lesson-feedback');

  const backStepBtn = document.getElementById('lesson-back-step-btn');
  const nextStepBtn = document.getElementById('lesson-next-step-btn');
  const hintBtn = document.getElementById('lesson-hint-btn');
  const retryBtn = document.getElementById('lesson-retry-btn');
  const continueBtn = document.getElementById('lesson-continue-btn');
  const lessonMenuBtn = document.getElementById('lesson-menu-btn');

  const lessonBoardView = createBoardView(lessonCanvas, { container: lessonBoardWrap });

  const PROGRESS_KEY = 'go-tutorial-progress-v1';

  function loadProgress() {
    try { return new Set(JSON.parse(localStorage.getItem(PROGRESS_KEY)) || []); }
    catch (_) { return new Set(); }
  }
  function saveProgress() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify([...completedLessons])); }
    catch (_) { /* storage unavailable — degrade silently */ }
  }
  let completedLessons = loadProgress();

  function showScreen(el) {
    document.querySelectorAll('.screen.active').forEach((s) => s.classList.remove('active'));
    el.classList.add('active');
  }

  // ---------- Learn screen (module/lesson list) ----------

  function findLesson(lessonId) {
    for (const mod of TUTORIAL_MODULES) {
      const lesson = mod.lessons.find((l) => l.id === lessonId);
      if (lesson) return { module: mod, lesson };
    }
    return null;
  }

  function renderLessonList() {
    lessonListEl.innerHTML = '';
    for (const mod of TUTORIAL_MODULES) {
      const heading = document.createElement('h3');
      heading.className = 'lesson-module-title';
      heading.textContent = mod.title;
      lessonListEl.appendChild(heading);

      if (mod.lessons.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'lesson-module-empty';
        empty.textContent = 'Coming soon';
        lessonListEl.appendChild(empty);
        continue;
      }

      for (const lesson of mod.lessons) {
        const row = document.createElement('button');
        row.className = 'lesson-row';
        const left = document.createElement('span');
        left.textContent = lesson.title;
        const right = document.createElement('span');
        right.className = 'lesson-type-tag';
        if (completedLessons.has(lesson.id)) {
          right.innerHTML = '<span class="lesson-check">✓</span>';
        } else if (lesson.type === 'practice') {
          right.textContent = 'Practice';
        } else if (lesson.type === 'game') {
          right.textContent = 'Game';
        } else {
          right.textContent = 'Walkthrough';
        }
        row.appendChild(left);
        row.appendChild(right);
        row.addEventListener('click', () => startLesson(lesson.id));
        lessonListEl.appendChild(row);
      }
    }
  }

  function openLearnScreen() {
    renderLessonList();
    showScreen(learnScreen);
  }
  window.Tutorial = { openLearnScreen };

  learnBackBtn.addEventListener('click', () => {
    showScreen(document.getElementById('setup-screen'));
  });

  // ---------- Lesson player ----------

  let currentLesson = null;
  let lessonGame = null;
  let stepIndex = 0;
  let hintIndex = 0;
  let practiceSuccess = false;

  function startLesson(lessonId) {
    const found = findLesson(lessonId);
    if (!found) return;
    currentLesson = found.lesson;
    showScreen(lessonScreen);

    // Each render*Step function sets its own text and resizes the board to
    // match, so this rAF just needs to wait one frame for the now-visible
    // lesson screen to actually be laid out before the first measurement.
    if (currentLesson.type === 'walkthrough') {
      stepIndex = 0;
      lessonGame = new GoGame(currentLesson.boardSize || 9, 0);
      requestAnimationFrame(renderWalkthroughStep);
    } else if (currentLesson.type === 'game') {
      stepIndex = 0;
      lessonGame = new GoGame(currentLesson.boardSize || 9, currentLesson.komi || 0);
      requestAnimationFrame(renderGameStep);
    } else {
      setupPractice();
      requestAnimationFrame(renderPractice);
    }
  }

  function setButtonsVisible(map) {
    backStepBtn.classList.toggle('hidden', !map.back);
    nextStepBtn.classList.toggle('hidden', !map.next);
    hintBtn.classList.toggle('hidden', !map.hint);
    retryBtn.classList.toggle('hidden', !map.retry);
    continueBtn.classList.toggle('hidden', !map.continueBtn);
  }

  // Flattened lesson order across every module that has content, so both
  // lesson types advance through the whole curriculum the same way rather
  // than dead-ending at a module boundary.
  function lessonSequence() {
    const seq = [];
    for (const mod of TUTORIAL_MODULES) {
      for (const lesson of mod.lessons) seq.push(lesson);
    }
    return seq;
  }

  function nextLessonAfter(lessonId) {
    const seq = lessonSequence();
    const idx = seq.findIndex((lesson) => lesson.id === lessonId);
    if (idx < 0 || idx === seq.length - 1) return null;
    return seq[idx + 1];
  }

  function isLastLesson(lessonId) {
    return nextLessonAfter(lessonId) === null;
  }

  // Mark the current lesson done, then move on to the next one — or back to
  // the menu if this was the final lesson. Shared by walkthroughs and
  // practice so both behave identically.
  function advanceToNextLesson() {
    completeLesson();
    const next = nextLessonAfter(currentLesson.id);
    if (next) {
      startLesson(next.id);
    } else {
      openLearnScreen();
    }
  }

  function renderWalkthroughStep() {
    const step = currentLesson.steps[stepIndex];
    lessonGame.loadPosition(step.stones, BLACK);
    if (step.lastMove) lessonGame.lastMove = step.lastMove;

    // Caption length varies step to step, which changes how much height
    // #lesson-text takes and therefore how much is left for the board. Set
    // the text first so the resize below measures the real, current layout
    // rather than sizing the canvas for whatever the previous step needed.
    lessonCaptionEl.textContent = step.caption;
    lessonFeedbackEl.textContent = '';
    lessonProgressEl.textContent = `Step ${stepIndex + 1}/${currentLesson.steps.length}`;
    lessonBoardView.resize(lessonGame.size);
    lessonBoardView.render(lessonGame, {
      markers: step.markers,
      showTerritory: !!step.showTerritory,
      showLastMove: true,
    });

    const isLastStep = stepIndex === currentLesson.steps.length - 1;
    nextStepBtn.textContent = (isLastStep && isLastLesson(currentLesson.id)) ? 'Finish' : 'Next';
    setButtonsVisible({ back: true, next: true });
    backStepBtn.disabled = stepIndex === 0;
  }

  // ---------- Recorded game replay ----------
  //
  // A game lesson stores only its move list, and the board for any step is
  // rebuilt by replaying those moves through the real engine. That keeps a
  // 60-move record compact to author, makes captures happen for real rather
  // than being hand-drawn into a snapshot, and means an illegal move in a
  // record cannot silently render as a plausible-looking board — it is
  // caught by the same rules a played game runs under.
  //
  // Steps are: 0 = empty board with the intro, 1..N = the position after
  // that many moves (captioned with that move's commentary), and a final
  // step showing the finished position with territory shaded.

  function gameStepTotal() {
    return currentLesson.moves.length + 2; // intro + every move + summary
  }

  function renderGameStep() {
    const moves = currentLesson.moves;
    const shown = Math.min(Math.max(stepIndex, 0), moves.length);
    const isIntro = stepIndex === 0;
    const isSummary = stepIndex === moves.length + 1;

    // Replaying from the start on every step keeps back/forward navigation
    // trivially correct — there is no incremental undo state to get wrong.
    lessonGame = new GoGame(currentLesson.boardSize || 9, currentLesson.komi || 0);
    for (let i = 0; i < shown; i++) {
      if (moves[i].pass) lessonGame.pass();
      else lessonGame.playMove(moves[i].row, moves[i].col);
    }

    const current = shown > 0 ? moves[shown - 1] : null;

    // Commentary length varies a lot between a one-line move note and the
    // multi-sentence intro/summary, which changes how much of the screen
    // #lesson-text takes. Set the text first so resize() measures the real,
    // current layout instead of sizing the canvas for the previous step.
    if (isIntro) {
      lessonProgressEl.textContent = currentLesson.title;
      lessonCaptionEl.textContent = currentLesson.intro;
    } else if (isSummary) {
      lessonProgressEl.textContent = 'Final position';
      lessonCaptionEl.textContent = currentLesson.summary;
    } else {
      // Moves alternate from Black, so the colour follows from the index —
      // a pass is still a turn, so this holds across one.
      const colorName = shown % 2 === 1 ? 'Black' : 'White';
      const label = current.pass ? `${colorName} passes` : colorName;
      lessonProgressEl.textContent = `Move ${shown} / ${moves.length} — ${label}`;
      lessonCaptionEl.textContent = current.note;
    }
    lessonFeedbackEl.textContent = '';
    lessonBoardView.resize(lessonGame.size);
    lessonBoardView.render(lessonGame, {
      markers: isIntro || isSummary ? currentLesson.markers : current && current.markers,
      // Only a game played to its end has meaningful territory to shade; an
      // opening study would just shade whatever happens to be enclosed so far
      // and read as a score that isn't real yet.
      showTerritory: isSummary && !!currentLesson.showFinalTerritory,
      showLastMove: !isIntro,
    });

    const isLastStep = stepIndex === gameStepTotal() - 1;
    nextStepBtn.textContent = (isLastStep && isLastLesson(currentLesson.id)) ? 'Finish' : 'Next';
    setButtonsVisible({ back: true, next: true });
    backStepBtn.disabled = stepIndex === 0;
  }

  function stepTotal() {
    return currentLesson.type === 'game' ? gameStepTotal() : currentLesson.steps.length;
  }

  function renderStep() {
    if (currentLesson.type === 'game') renderGameStep();
    else renderWalkthroughStep();
  }

  backStepBtn.addEventListener('click', () => {
    if (stepIndex > 0) {
      stepIndex--;
      renderStep();
    }
  });

  nextStepBtn.addEventListener('click', () => {
    if (stepIndex < stepTotal() - 1) {
      stepIndex++;
      renderStep();
    } else {
      advanceToNextLesson();
    }
  });

  function setupPractice() {
    lessonGame = new GoGame(currentLesson.boardSize || 9, 0);
    lessonGame.loadPosition(currentLesson.initialStones, currentLesson.toPlay);
    if (currentLesson.setupMoves) {
      for (const m of currentLesson.setupMoves) lessonGame.playMove(m.row, m.col);
    }
    hintIndex = 0;
    practiceSuccess = false;
  }

  function renderPractice() {
    // Set the goal text first (see renderWalkthroughStep for why) so the
    // resize below measures the layout with this lesson's actual text height.
    lessonCaptionEl.textContent = currentLesson.goal;
    lessonFeedbackEl.textContent = '';
    lessonFeedbackEl.classList.remove('error');
    lessonProgressEl.textContent = currentLesson.title;
    lessonBoardView.resize(lessonGame.size);
    lessonBoardView.render(lessonGame, { markers: currentLesson.markers, showLastMove: true });
    continueBtn.textContent = isLastLesson(currentLesson.id) ? 'Finish' : 'Next';
    setButtonsVisible({
      hint: !!(currentLesson.hints && currentLesson.hints.length),
      retry: true,
      continueBtn: practiceSuccess,
    });
    hintBtn.disabled = !currentLesson.hints || hintIndex >= currentLesson.hints.length;
  }

  lessonBoardView.onIntersectionClick((row, col) => {
    if (!currentLesson || currentLesson.type !== 'practice' || practiceSuccess) return;
    const moveResult = lessonGame.playMove(row, col);
    lessonBoardView.render(lessonGame, { markers: currentLesson.markers, showLastMove: true });

    const ok = currentLesson.checkSuccess(lessonGame, moveResult);
    if (ok) {
      practiceSuccess = true;
      lessonFeedbackEl.textContent = 'Correct!';
      lessonFeedbackEl.classList.remove('error');
      setButtonsVisible({ hint: false, retry: true, continueBtn: true });
    } else {
      if (moveResult.legal) {
        // Undo the failed attempt so the puzzle position resets and the
        // learner can try again immediately, rather than having consumed
        // their one move on a wrong guess.
        lessonGame.undo();
        lessonBoardView.render(lessonGame, { markers: currentLesson.markers, showLastMove: true });
      }
      lessonFeedbackEl.textContent = moveResult.legal
        ? 'Not quite — try again.'
        : 'That move isn’t legal there. Try another point.';
      lessonFeedbackEl.classList.add('error');
    }
  });

  hintBtn.addEventListener('click', () => {
    if (!currentLesson.hints || hintIndex >= currentLesson.hints.length) return;
    lessonFeedbackEl.textContent = currentLesson.hints[hintIndex];
    lessonFeedbackEl.classList.remove('error');
    hintIndex++;
    hintBtn.disabled = hintIndex >= currentLesson.hints.length;
  });

  retryBtn.addEventListener('click', () => {
    setupPractice();
    renderPractice();
  });

  continueBtn.addEventListener('click', advanceToNextLesson);

  lessonMenuBtn.addEventListener('click', openLearnScreen);

  function completeLesson() {
    completedLessons.add(currentLesson.id);
    saveProgress();
  }

  lessonExitBtn.addEventListener('click', () => {
    openLearnScreen();
  });
})();
