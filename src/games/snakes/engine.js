// مار و پله: تخته، پله‌ها و مارها.

export const SIZE = 10;

export const LADDERS = new Map([
  [2, 23],
  [6, 45],
  [20, 59],
  [43, 84],
  [52, 72],
  [57, 96],
  [71, 92],
]);

export const SNAKES = new Map([
  [98, 79],
  [95, 75],
  [88, 24],
  [62, 19],
  [48, 26],
  [36, 6],
  [32, 10],
  [17, 7],
]);

export const LADDERS_EASY = new Map([
  ...LADDERS,
  [9, 31],
  [27, 55],
  [38, 66],
  [64, 87],
]);

export const SNAKES_HARD = new Map([
  ...SNAKES,
  [91, 44],
  [79, 41],
  [54, 12],
  [44, 15],
  [28, 4],
]);

export const VARIANTS = {
  easy: { ladders: LADDERS_EASY, snakes: new Map([[98, 79], [88, 24], [62, 19], [36, 6], [32, 10]]) },
  medium: { ladders: LADDERS, snakes: SNAKES },
  hard: { ladders: new Map([[6, 45], [20, 59], [57, 96], [71, 92]]), snakes: SNAKES_HARD },
};

function activeVariant() {
  return current;
}

let current = VARIANTS.medium;

export function setVariant(name) {
  current = VARIANTS[name] || VARIANTS.medium;
  return current;
}

export function jump(cell, variant = current) {
  if (variant.ladders.has(cell)) return variant.ladders.get(cell);
  if (variant.snakes.has(cell)) return variant.snakes.get(cell);
  return cell;
}

// مختصات خانه در تخته: x و y از ۰ تا ۹ (چپ و بالا مبدأ).
export function displayPos(cell) {
  const i = cell - 1;
  const r = Math.floor(i / SIZE); // ردیف از پایین
  const c = i % SIZE;
  const x = r % 2 === 0 ? SIZE - 1 - c : c;
  const y = SIZE - 1 - r;
  return { x, y };
}

// شماره‌ی خانه برای سطر/ستونِ نمایشی
export function numberAt(dr, dc) {
  const r = SIZE - 1 - dr;
  return r % 2 === 0 ? r * SIZE + (SIZE - dc) : r * SIZE + dc + 1;
}

export function applyRoll(position, roll, variant = activeVariant()) {
  if (position + roll > 100) return { pos: position, landed: position, moved: false };
  const landed = position + roll;
  const target = jump(landed, variant);
  return { pos: target, landed, moved: true, jumped: target !== landed };
}
