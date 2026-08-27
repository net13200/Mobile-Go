// Reusable canvas board renderer + hit-testing. No game-screen-specific
// state (no HUD, no modal, no scoring banner) — just drawing a GoGame onto
// a canvas and mapping clicks back to board points. Multiple independent
// instances can coexist (e.g. the main game board and a tutorial lesson
// board) since each call takes the game as a parameter rather than closing
// over a single global one.

const STAR_POINTS = {
  9: [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]],
  13: [[3, 3], [3, 9], [9, 3], [9, 9], [6, 6]],
  19: [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]],
};

function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function createBoardView(canvasEl, opts = {}) {
  const container = opts.container || canvasEl.parentElement;
  const ctx = canvasEl.getContext('2d');
  const dpr = Math.max(window.devicePixelRatio || 1, 1);

  let boardSize = 0;
  let cellPx = 0;
  let marginPx = 0;

  function resize(size) {
    boardSize = size;
    const rect = container.getBoundingClientRect();
    const available = Math.max(Math.min(rect.width, rect.height) - 4, 100);
    const cells = size - 1;
    cellPx = available / (cells + 1.4);
    marginPx = cellPx * 0.7;
    const boardPx = Math.round(cells * cellPx + marginPx * 2);

    canvasEl.style.width = boardPx + 'px';
    canvasEl.style.height = boardPx + 'px';
    canvasEl.width = Math.round(boardPx * dpr);
    canvasEl.height = Math.round(boardPx * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function boardToPx(row, col) {
    return {
      x: marginPx + col * cellPx,
      y: marginPx + row * cellPx,
    };
  }

  function drawStone(x, y, radius, color, isDead) {
    ctx.save();
    if (isDead) ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    let grad;
    if (color === BLACK) {
      grad = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.35, radius * 0.1, x, y, radius);
      grad.addColorStop(0, getCssVar('--black-stone-a'));
      grad.addColorStop(1, getCssVar('--black-stone-b'));
    } else {
      grad = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.35, radius * 0.1, x, y, radius);
      grad.addColorStop(0, getCssVar('--white-stone-a'));
      grad.addColorStop(1, getCssVar('--white-stone-b'));
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

  function drawTerritoryPreview(game, stoneRadius) {
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

  function drawMarker(marker, stoneRadius) {
    const p = boardToPx(marker.row, marker.col);
    if (marker.type === 'target') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, stoneRadius * 0.55, 0, Math.PI * 2);
      ctx.strokeStyle = '#e0524a';
      ctx.lineWidth = Math.max(stoneRadius * 0.16, 1.5);
      ctx.stroke();
    } else {
      // 'ring' (and default): a small hollow circle marking a point of interest
      ctx.beginPath();
      ctx.arc(p.x, p.y, stoneRadius * 0.42, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(60,40,10,0.75)';
      ctx.lineWidth = Math.max(stoneRadius * 0.14, 1.5);
      ctx.stroke();
    }
  }

  function render(game, renderOpts = {}) {
    const size = game.size;
    const boardPx = marginPx * 2 + (size - 1) * cellPx;

    ctx.clearRect(0, 0, boardPx, boardPx);

    const grad = ctx.createLinearGradient(0, 0, boardPx, boardPx);
    grad.addColorStop(0, getCssVar('--board-wood-light'));
    grad.addColorStop(1, getCssVar('--board-wood'));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, boardPx, boardPx);

    ctx.strokeStyle = getCssVar('--board-line');
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

    const stars = STAR_POINTS[size] || [];
    ctx.fillStyle = getCssVar('--board-line');
    for (const [r, c] of stars) {
      const p = boardToPx(r, c);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(cellPx * 0.09, 2), 0, Math.PI * 2);
      ctx.fill();
    }

    const stoneRadius = cellPx * 0.46;
    for (let idx = 0; idx < game.board.length; idx++) {
      const color = game.board[idx];
      if (color === EMPTY) continue;
      const [r, c] = game.rowCol(idx);
      const p = boardToPx(r, c);
      drawStone(p.x, p.y, stoneRadius, color, game.deadStones.has(idx));
    }

    const showLastMove = renderOpts.showLastMove !== false;
    if (game.lastMove && showLastMove) {
      const p = boardToPx(game.lastMove.row, game.lastMove.col);
      ctx.beginPath();
      ctx.arc(p.x, p.y, stoneRadius * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = game.lastMove.color === BLACK ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.75)';
      ctx.fill();
    }

    if (renderOpts.showTerritory) {
      drawTerritoryPreview(game, stoneRadius);
    }

    if (renderOpts.markers) {
      for (const marker of renderOpts.markers) drawMarker(marker, stoneRadius);
    }
  }

  function pixelToPoint(clientX, clientY) {
    const rect = canvasEl.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const col = Math.round((x - marginPx) / cellPx);
    const row = Math.round((y - marginPx) / cellPx);
    if (row < 0 || row >= boardSize || col < 0 || col >= boardSize) return null;

    const p = boardToPx(row, col);
    const dist = Math.hypot(x - p.x, y - p.y);
    if (dist > cellPx * 0.5) return null;

    return { row, col };
  }

  function onIntersectionClick(handler) {
    canvasEl.addEventListener('click', (e) => {
      const p = pixelToPoint(e.clientX, e.clientY);
      if (p) handler(p.row, p.col, e);
    }, { passive: true });
  }

  return {
    resize,
    render,
    pixelToPoint,
    onIntersectionClick,
    get cellPx() { return cellPx; },
  };
}
