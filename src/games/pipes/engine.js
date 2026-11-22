// لوله‌کشی آب: ساخت جدول حل‌شدنی و جریان آب.

const N = 1;
const E = 2;
const S = 4;
const W = 8;

export const DIRS = [
  { bit: N, dr: -1, dc: 0, opp: S },
  { bit: E, dr: 0, dc: 1, opp: W },
  { bit: S, dr: 1, dc: 0, opp: N },
  { bit: W, dr: 0, dc: -1, opp: E },
];

export const SIZES = { easy: 5, medium: 6, hard: 7 };

export function rotateMask(mask, times) {
  let m = mask;
  for (let i = 0; i < ((times % 4) + 4) % 4; i++) {
    m = ((m << 1) & 15) | (m & 8 ? N : 0);
  }
  return m;
}

export function maskOf(state, index) {
  return rotateMask(state.base[index], state.rot[index]);
}

export function createPuzzle(size, rng = Math.random) {
  const total = size * size;
  const base = new Uint8Array(total);
  const visited = new Array(total).fill(false);
  const start = Math.floor(rng() * total);
  const stack = [start];
  visited[start] = true;

  while (stack.length) {
    const cell = stack[stack.length - 1];
    const r = Math.floor(cell / size);
    const c = cell % size;
    const options = [];
    for (const dir of DIRS) {
      const nr = r + dir.dr;
      const nc = c + dir.dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      const ni = nr * size + nc;
      if (!visited[ni]) options.push({ dir, ni });
    }
    if (!options.length) {
      stack.pop();
      continue;
    }
    const pick = options[Math.floor(rng() * options.length)];
    base[cell] |= pick.dir.bit;
    base[pick.ni] |= pick.dir.opp;
    visited[pick.ni] = true;
    stack.push(pick.ni);
  }

  // شیر آب روی یکی از خانه‌های ردیف بالا تا ورودی از بیرون جدول باشد
  const source = Math.floor(rng() * size);
  base[source] |= N;

  const rot = new Uint8Array(total);
  for (let i = 0; i < total; i++) rot[i] = Math.floor(rng() * 4);
  // شیر ثابت است و همیشه ورودی شمالی دارد
  rot[source] = 0;

  const solution = new Uint8Array(total);
  const state = { size, base, rot, source, solution };
  if (isSolved(state)) {
    for (let i = 0; i < total && isSolved(state); i++) {
      if (i === source) continue;
      rot[i] = (rot[i] + 1) % 4;
    }
  }
  return state;
}

// جهت‌هایی که لوله به بیرون یا به همسایه‌ی ناهم‌سو باز مانده است
export function openDirections(state, index) {
  const { size } = state;
  const r = Math.floor(index / size);
  const c = index % size;
  const mask = maskOf(state, index);
  const out = [];
  for (const dir of DIRS) {
    if (!(mask & dir.bit)) continue;
    const nr = r + dir.dr;
    const nc = c + dir.dc;
    if (nr < 0 || nr >= size || nc < 0 || nc >= size) {
      out.push(dir);
      continue;
    }
    const ni = nr * size + nc;
    if (!(maskOf(state, ni) & dir.opp)) out.push(dir);
  }
  return out;
}

export function waterCells(state) {
  const seen = new Set([state.source]);
  const queue = [state.source];
  const { size } = state;
  while (queue.length) {
    const i = queue.pop();
    const r = Math.floor(i / size);
    const c = i % size;
    const mask = maskOf(state, i);
    for (const dir of DIRS) {
      if (!(mask & dir.bit)) continue;
      const nr = r + dir.dr;
      const nc = c + dir.dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      const ni = nr * size + nc;
      if (seen.has(ni)) continue;
      if (!(maskOf(state, ni) & dir.opp)) continue;
      seen.add(ni);
      queue.push(ni);
    }
  }
  return seen;
}

export function rotateCell(state, index) {
  const rot = state.rot.slice();
  rot[index] = (rot[index] + 1) % 4;
  return { ...state, rot };
}

export function isSolved(state) {
  return waterCells(state).size === state.size * state.size;
}
