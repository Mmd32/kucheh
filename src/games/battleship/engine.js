// نبرد دریایی: چیدن ناوها، شلیک و حافظه‌ی کامپیوتر.

export const SIZE = 10;
export const FLEET = [5, 4, 3, 3, 2];
export const FLEETS = {
  easy: [4, 3, 3, 2],
  medium: [5, 4, 3, 3, 2],
  hard: [5, 4, 4, 3, 3, 2, 2],
};

export function emptyBoard() {
  return { ships: [], shots: Array(100).fill(null) };
}

export function cloneBoard(board) {
  return {
    ships: board.ships.map((ship) => ({ ...ship, cells: ship.cells.slice(), hits: ship.hits.slice() })),
    shots: board.shots.slice(),
  };
}

export function cellsFor(row, col, size, dir) {
  const out = [];
  for (let i = 0; i < size; i++) {
    const r = dir === 'v' ? row + i : row;
    const c = dir === 'h' ? col + i : col;
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return null;
    out.push(r * SIZE + c);
  }
  return out;
}

export function canPlace(board, cells) {
  if (!cells) return false;
  const banned = new Set();
  for (const ship of board.ships) {
    for (const cell of ship.cells) {
      const r = Math.floor(cell / SIZE);
      const c = cell % SIZE;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE) banned.add(rr * SIZE + cc);
        }
      }
    }
  }
  return cells.every((cell) => !banned.has(cell));
}

export function randomBoard(rng = Math.random, fleet = FLEET) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const board = emptyBoard();
    let ok = true;
    for (const size of fleet) {
      let placed = false;
      for (let tries = 0; tries < 400 && !placed; tries++) {
        const dir = rng() < 0.5 ? 'h' : 'v';
        const row = Math.floor(rng() * SIZE);
        const col = Math.floor(rng() * SIZE);
        const cells = cellsFor(row, col, size, dir);
        if (cells && canPlace(board, cells)) {
          board.ships.push({ size, cells, hits: [] });
          placed = true;
        }
      }
      if (!placed) {
        ok = false;
        break;
      }
    }
    if (ok) return board;
  }
  return emptyBoard();
}

export function shipAt(board, index) {
  return board.ships.find((ship) => ship.cells.includes(index)) || null;
}

export function allSunk(board) {
  return board.ships.length > 0 && board.ships.every((ship) => ship.hits.length >= ship.size);
}

export function fireAt(target, index) {
  if (target.shots[index]) return { result: 'repeat', target };
  const ship = shipAt(target, index);
  const next = cloneBoard(target);
  next.shots[index] = ship ? 'hit' : 'miss';
  let sunkShip = null;
  if (ship) {
    const live = next.ships.find((s) => s.cells.includes(index));
    live.hits.push(index);
    if (live.hits.length >= live.size) sunkShip = live;
  }
  const result = sunkShip ? 'sunk' : ship ? 'hit' : 'miss';
  return { result, target: next, ship: sunkShip };
}

export function createAi() {
  return { shots: new Set(), queue: [], blocked: new Set() };
}

function neighbors(index) {
  const r = Math.floor(index / SIZE);
  const c = index % SIZE;
  const out = [];
  if (r > 0) out.push(index - SIZE);
  if (r < SIZE - 1) out.push(index + SIZE);
  if (c > 0) out.push(index - 1);
  if (c < SIZE - 1) out.push(index + 1);
  return out;
}

export function aiNextShot(ai) {
  while (ai.queue.length) {
    const candidate = ai.queue.shift();
    if (!ai.shots.has(candidate) && !ai.blocked.has(candidate)) return candidate;
  }
  const parity = [];
  const rest = [];
  for (let i = 0; i < 100; i++) {
    if (ai.shots.has(i) || ai.blocked.has(i)) continue;
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    if ((r + c) % 2 === 0) parity.push(i);
    else rest.push(i);
  }
  const pool = parity.length ? parity : rest;
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

export function aiRecord(ai, index, result, ship) {
  ai.shots.add(index);
  if (result === 'hit') {
    for (const n of neighbors(index)) {
      if (!ai.shots.has(n) && !ai.blocked.has(n)) ai.queue.push(n);
    }
  }
  if (result === 'sunk' && ship) {
    for (const cell of ship.cells) {
      ai.shots.add(cell);
      for (const n of neighbors(cell)) {
        if (!ai.shots.has(n)) ai.blocked.add(n);
      }
    }
    ai.queue = ai.queue.filter((c) => !ship.cells.includes(c) && !ai.blocked.has(c));
  }
}
