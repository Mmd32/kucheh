// تولید جدول‌های پارکینگ و محاسبه‌ی کمترین حرکت لازم. یک‌بار اجرا می‌شود و خروجی در داده‌ی بازی ذخیره می‌شود.

import { SIZE, fromLayout, occupancy, canSlide, solveMin } from '../src/games/parking/engine.js';

const RANGES = { easy: [5, 8], medium: [9, 12], hard: [13, 20] };

function randInt(min, max, rng) {
  return min + Math.floor(rng() * (max - min + 1));
}

function shuffle(list, rng) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function randomLayout(rng) {
  const redCol = randInt(0, 2, rng);
  const cars = [['X', 2, redCol, 2, 'h']];
  const others = randInt(10, 12, rng);
  let attempts = 0;
  while (cars.length < others + 1 && attempts < 400) {
    attempts += 1;
    const len = rng() < 0.3 ? 3 : 2;
    const dir = rng() < 0.5 ? 'h' : 'v';
    const r = randInt(0, SIZE - 1, rng);
    const c = randInt(0, SIZE - 1, rng);
    const candidate = [String.fromCharCode(65 + cars.length), r, c, len, dir];
    const state = fromLayout([...cars, candidate]);
    const occ = occupancy({ cars: state.cars.slice(0, -1) });
    const cells = [];
    for (let k = 0; k < len; k++) {
      const rr = dir === 'v' ? r + k : r;
      const cc = dir === 'h' ? c + k : c;
      if (rr >= SIZE || cc >= SIZE) {
        cells.length = 0;
        break;
      }
      cells.push(rr * SIZE + cc);
    }
    if (!cells.length) continue;
    if (cells.some((cell) => occ.has(cell))) continue;
    cars.push(candidate);
  }
  return cars;
}

const result = { easy: [], medium: [], hard: [] };
const rng = Math.random;
const started = Date.now();

for (let attempt = 0; attempt < 4000 && Date.now() - started < 150000; attempt++) {
  const layout = randomLayout(rng);
  const state = fromLayout(layout);
  const min = solveMin(state, { maxNodes: 70000 });
  if (!Number.isFinite(min) || min === 0) continue;
  for (const [level, [lo, hi]] of Object.entries(RANGES)) {
    if (min < lo || min > hi) continue;
    if (result[level].length >= 8) continue;
    if (result[level].some((entry) => JSON.stringify(entry.layout) === JSON.stringify(layout))) continue;
    result[level].push({ layout, min });
  }
  if (Object.values(result).every((list) => list.length >= 8)) break;
}

const encode = (entry) => `    { min: ${entry.min}, layout: ${JSON.stringify(entry.layout)} },`;
const sections = Object.entries(result)
  .map(([level, list]) => `  ${level}: [\n${list.map(encode).join('\n')}\n  ],`)
  .join('\n');

console.log(`// تولیدشده با scripts/gen-parking.mjs — ${new Date().toISOString()}`);
console.log('export const PARKING_LEVELS = {');
console.log(sections);
console.log('};');
console.error(
  Object.entries(result)
    .map(([level, list]) => `${level}: ${list.length} (${list.map((e) => e.min).join(', ')})`)
    .join(' | '),
);
