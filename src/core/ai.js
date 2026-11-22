// کمک‌کننده‌های هوش مصنوعی مشترک بین بازی‌ها.

export function chooseBest(candidates, scoreFn, { noise = 0, rng = Math.random } = {}) {
  let best = [];
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    let score = scoreFn(candidate);
    if (noise > 0) score += (rng() - 0.5) * 2 * noise;
    if (score > bestScore + 1e-9) {
      bestScore = score;
      best = [candidate];
    } else if (Math.abs(score - bestScore) <= 1e-9) {
      best.push(candidate);
    }
  }
  if (!best.length) return candidates[0];
  return best[Math.floor(rng() * best.length)];
}

export function materialValue(piece) {
  switch (piece.toLowerCase()) {
    case 'p':
      return 100;
    case 'n':
      return 320;
    case 'b':
      return 330;
    case 'r':
      return 500;
    case 'q':
      return 900;
    case 'k':
      return 0;
    default:
      return 0;
  }
}
