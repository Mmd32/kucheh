// پارکینگ: ماشین قرمز را از چاله‌ی خروج بیرون بکش.

export const SIZE = 6;
export const EXIT_ROW = 2;

export function fromLayout(layout) {
  return {
    cars: layout.map(([id, r, c, len, dir]) => ({ id, r, c, len, dir })),
  };
}

export function cloneState(state) {
  return { cars: state.cars.map((car) => ({ ...car })) };
}

export function carById(state, id) {
  return state.cars.find((car) => car.id === id) || null;
}

export function carCells(car) {
  const cells = [];
  for (let k = 0; k < car.len; k++) {
    const r = car.dir === 'v' ? car.r + k : car.r;
    const c = car.dir === 'h' ? car.c + k : car.c;
    cells.push({ r, c, index: r * SIZE + c });
  }
  return cells;
}

export function occupancy(state, ignoreId = null) {
  const map = new Map();
  for (const car of state.cars) {
    if (car.id === ignoreId) continue;
    for (const cell of carCells(car)) map.set(cell.index, car.id);
  }
  return map;
}

export function canSlide(state, car, delta) {
  if (!delta) return false;
  const occ = occupancy(state, car.id);
  const r0 = car.dir === 'v' ? car.r + delta : car.r;
  const c0 = car.dir === 'h' ? car.c + delta : car.c;
  for (let k = 0; k < car.len; k++) {
    const r = car.dir === 'v' ? r0 + k : r0;
    const c = car.dir === 'h' ? c0 + k : c0;
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
    if (occ.has(r * SIZE + c)) return false;
  }
  return true;
}

export function slide(state, carId, delta) {
  const next = cloneState(state);
  const car = next.cars.find((item) => item.id === carId);
  if (!car) return state;
  if (car.dir === 'v') car.r += delta;
  else car.c += delta;
  return next;
}

export function isSolved(state) {
  const red = carById(state, 'X');
  return Boolean(red && red.dir === 'h' && red.r === EXIT_ROW && red.c + red.len === SIZE);
}

export function stateKey(state) {
  return state.cars.map((car) => `${car.id}:${car.r},${car.c}`).join('|');
}

// کمترین تعداد حرکت با جست‌وجوی سطح‌اول
export function solveMin(state, { maxNodes = 120000 } = {}) {
  if (isSolved(state)) return 0;
  const queue = [state];
  const depth = new Map([[stateKey(state), 0]]);
  let head = 0;
  while (head < queue.length && depth.size < maxNodes) {
    const current = queue[head];
    head += 1;
    const d = depth.get(stateKey(current));
    for (const car of current.cars) {
      for (const sign of [-1, 1]) {
        for (let k = 1; k <= SIZE; k++) {
          const delta = sign * k;
          if (!canSlide(current, car, delta)) break;
          const next = slide(current, car.id, delta);
          const key = stateKey(next);
          if (depth.has(key)) continue;
          if (isSolved(next)) return d + 1;
          depth.set(key, d + 1);
          queue.push(next);
          if (depth.size >= maxNodes) break;
        }
      }
    }
  }
  return Infinity;
}
