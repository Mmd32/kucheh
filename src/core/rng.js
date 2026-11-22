// اعداد تصادفی با قابلیت seed برای تست‌های تکرارپذیر.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(min, max, rng = Math.random) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function rollDice(count = 1, sides = 6, rng = Math.random) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(randomInt(1, sides, rng));
  return out;
}

export function shuffle(array, rng = Math.random) {
  const out = array.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pick(array, rng = Math.random) {
  if (!array.length) return undefined;
  return array[Math.floor(rng() * array.length)];
}

export function pickFresh(pool, used, rng = Math.random) {
  const available = pool.filter((item) => !used.has(item));
  if (!available.length) {
    used.clear();
    return pick(pool, rng);
  }
  return pick(available, rng);
}
