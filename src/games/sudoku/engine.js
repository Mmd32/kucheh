// سودوکو: تولید جدول با پاسخ یکتا و شمارش جواب‌ها.

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function shuffle(list, rng = Math.random) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function popcount(x) {
  let n = 0;
  while (x) {
    x &= x - 1;
    n += 1;
  }
  return n;
}

export function indexInfo(i) {
  const r = Math.floor(i / 9);
  const c = i % 9;
  const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
  return { r, c, b };
}

export function fillGrid(grid, rng = Math.random) {
  const rows = new Uint16Array(9);
  const cols = new Uint16Array(9);
  const boxes = new Uint16Array(9);

  function rec(i) {
    if (i === 81) return true;
    const { r, c, b } = indexInfo(i);
    const used = rows[r] | cols[c] | boxes[b];
    for (const d of shuffle(DIGITS, rng)) {
      const bit = 1 << (d - 1);
      if (used & bit) continue;
      grid[i] = d;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      if (rec(i + 1)) return true;
      grid[i] = 0;
      rows[r] &= ~bit;
      cols[c] &= ~bit;
      boxes[b] &= ~bit;
    }
    return false;
  }

  return rec(0) ? grid : null;
}

export function countSolutions(board, limit = 2) {
  const b = Uint8Array.from(board);
  const rows = new Uint16Array(9);
  const cols = new Uint16Array(9);
  const boxes = new Uint16Array(9);

  for (let i = 0; i < 81; i++) {
    const v = b[i];
    if (!v) continue;
    const { r, c, b: bi } = indexInfo(i);
    const bit = 1 << (v - 1);
    rows[r] |= bit;
    cols[c] |= bit;
    boxes[bi] |= bit;
  }

  let count = 0;

  function rec() {
    if (count >= limit) return;
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;

    for (let i = 0; i < 81; i++) {
      if (b[i]) continue;
      const { r, c, b: bi } = indexInfo(i);
      const mask = ~(rows[r] | cols[c] | boxes[bi]) & 0x1ff;
      const n = popcount(mask);
      if (n === 0) return;
      if (n < bestCount) {
        bestCount = n;
        best = i;
        bestMask = mask;
        if (n === 1) break;
      }
    }

    if (best === -1) {
      count += 1;
      return;
    }

    const { r, c, b: bi } = indexInfo(best);
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << (d - 1);
      if (!(bestMask & bit)) continue;
      b[best] = d;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[bi] |= bit;
      rec();
      b[best] = 0;
      rows[r] &= ~bit;
      cols[c] &= ~bit;
      boxes[bi] &= ~bit;
      if (count >= limit) break;
    }
  }

  rec();
  return count;
}

export function solve(board) {
  const b = Uint8Array.from(board);
  const rows = new Uint16Array(9);
  const cols = new Uint16Array(9);
  const boxes = new Uint16Array(9);
  for (let i = 0; i < 81; i++) {
    const v = b[i];
    if (!v) continue;
    const { r, c, b: bi } = indexInfo(i);
    const bit = 1 << (v - 1);
    rows[r] |= bit;
    cols[c] |= bit;
    boxes[bi] |= bit;
  }

  function rec() {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (b[i]) continue;
      const { r, c, b: bi } = indexInfo(i);
      const mask = ~(rows[r] | cols[c] | boxes[bi]) & 0x1ff;
      const n = popcount(mask);
      if (n === 0) return false;
      if (n < bestCount) {
        bestCount = n;
        best = i;
        bestMask = mask;
        if (n === 1) break;
      }
    }
    if (best === -1) return true;
    const { r, c, b: bi } = indexInfo(best);
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << (d - 1);
      if (!(bestMask & bit)) continue;
      b[best] = d;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[bi] |= bit;
      if (rec()) return true;
      b[best] = 0;
      rows[r] &= ~bit;
      cols[c] &= ~bit;
      boxes[bi] &= ~bit;
    }
    return false;
  }

  return rec() ? Array.from(b) : null;
}

const CLUES = { easy: 40, medium: 32, hard: 27 };

export function generate(difficulty = 'medium', { rng = Math.random, maxMs = 4000 } = {}) {
  const solution = new Uint8Array(81);
  if (!fillGrid(solution, rng)) throw new Error('ساخت جدول ممکن نشد');
  const puzzle = solution.slice();
  const target = CLUES[difficulty] ?? 32;
  const order = shuffle([...Array(81).keys()], rng);
  const deadline = Date.now() + maxMs;
  let clues = 81;

  for (const idx of order) {
    if (clues <= target || Date.now() > deadline) break;
    const backup = puzzle[idx];
    puzzle[idx] = 0;
    if (countSolutions(puzzle, 2) === 1) clues -= 1;
    else puzzle[idx] = backup;
  }

  return { puzzle: Array.from(puzzle), solution: Array.from(solution) };
}

export function conflicts(entries) {
  // مجموعه‌ی اندیس‌هایی که با قانون سودوکو نمی‌خوانند.
  const bad = new Set();
  const groups = [];
  for (let r = 0; r < 9; r++) groups.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) groups.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let b = 0; b < 9; b++) {
    const r0 = Math.floor(b / 3) * 3;
    const c0 = (b % 3) * 3;
    const cells = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push((r0 + r) * 9 + c0 + c);
    groups.push(cells);
  }
  for (const group of groups) {
    const seen = new Map();
    for (const i of group) {
      const v = entries[i];
      if (!v) continue;
      if (seen.has(v)) {
        bad.add(i);
        bad.add(seen.get(v));
      } else {
        seen.set(v, i);
      }
    }
  }
  return bad;
}
