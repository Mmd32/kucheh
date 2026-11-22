// مین‌روب: منطق خالص، بدون DOM.

export const PRESETS = {
  easy: { rows: 9, cols: 9, mines: 10 },
  medium: { rows: 12, cols: 12, mines: 22 },
  hard: { rows: 14, cols: 14, mines: 38 },
};

export function neighbors(index, rows, cols) {
  const r = Math.floor(index / cols);
  const c = index % cols;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) out.push(rr * cols + cc);
    }
  }
  return out;
}

export function createGame(rows, cols, mines) {
  return {
    rows,
    cols,
    mines,
    cells: Array.from({ length: rows * cols }, () => ({ mine: false, revealed: false, flagged: false, count: 0 })),
    started: false,
    over: false,
    won: false,
    exploded: -1,
  };
}

export function cloneGame(state) {
  return { ...state, cells: state.cells.map((cell) => ({ ...cell })) };
}

export function placeMines(state, safeIndex, rng = Math.random) {
  const next = cloneGame(state);
  const forbidden = new Set([safeIndex, ...neighbors(safeIndex, next.rows, next.cols)]);
  const pool = [];
  for (let i = 0; i < next.cells.length; i++) if (!forbidden.has(i)) pool.push(i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = pool.slice(0, Math.min(next.mines, pool.length));
  for (const i of chosen) next.cells[i].mine = true;
  for (let i = 0; i < next.cells.length; i++) {
    next.cells[i].count = neighbors(i, next.rows, next.cols).filter((n) => next.cells[n].mine).length;
  }
  next.started = true;
  return next;
}

function openCell(state, index) {
  const cell = state.cells[index];
  if (cell.revealed || cell.flagged) return;
  cell.revealed = true;
  if (cell.mine) {
    state.over = true;
    state.exploded = index;
    return;
  }
  if (cell.count === 0) {
    const stack = [index];
    while (stack.length) {
      const current = stack.pop();
      for (const n of neighbors(current, state.rows, state.cols)) {
        const next = state.cells[n];
        if (next.revealed || next.flagged || next.mine) continue;
        next.revealed = true;
        if (next.count === 0) stack.push(n);
      }
    }
  }
}

export function reveal(state, index) {
  if (state.over) return state;
  const next = cloneGame(state);
  openCell(next, index);
  if (next.over) {
    for (const cell of next.cells) if (cell.mine) cell.revealed = true;
    return next;
  }
  next.won = next.cells.every((cell) => cell.mine || cell.revealed);
  if (next.won) next.over = true;
  return next;
}

export function toggleFlag(state, index) {
  if (state.over) return state;
  const next = cloneGame(state);
  const cell = next.cells[index];
  if (cell.revealed) return state;
  cell.flagged = !cell.flagged;
  return next;
}

export function flagsUsed(state) {
  return state.cells.filter((cell) => cell.flagged).length;
}

export function isComplete(state) {
  return state.over && state.won;
}
