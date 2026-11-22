// بیلیارد: فیزیک ساده‌ی دایره‌ها روی میز، بدون DOM.

export const TABLE = { w: 1000, h: 500, cushion: 28, ballR: 11, pocketR: 24 };
export const POCKETS = [
  { x: 30, y: 30 },
  { x: 500, y: 30 },
  { x: 970, y: 30 },
  { x: 30, y: 470 },
  { x: 500, y: 470 },
  { x: 970, y: 470 },
];

const COLORS = ['#e0b04a', '#2f6fbf', '#c0392b', '#7f4fa0', '#e07b39', '#2f9e6f', '#8a5a2b', '#555555', '#b03060'];
export const MAX_SPEED = 16;

export function createGame({ count = 7, rng = Math.random } = {}) {
  const balls = [{ id: 'cue', x: 250, y: 250, vx: 0, vy: 0, r: TABLE.ballR, color: '#faf6ea', number: 0, potted: false }];
  let placed = 0;
  for (let row = 0; placed < count; row++) {
    for (let k = 0; k <= row && placed < count; k++) {
      balls.push({
        id: `b${placed + 1}`,
        x: 650 + row * 24,
        y: 250 + (k - row / 2) * 28,
        vx: 0,
        vy: 0,
        r: TABLE.ballR,
        color: COLORS[placed % COLORS.length],
        number: placed + 1,
        potted: false,
      });
      placed += 1;
    }
  }
  return { balls, shots: 0, moving: false };
}

export function shoot(state, angle, power) {
  const balls = state.balls.map((item) => ({ ...item }));
  const cue = balls.find((item) => item.id === 'cue');
  if (!cue || cue.potted) return state;
  const speed = MAX_SPEED * Math.max(0.08, Math.min(1, power));
  cue.vx = Math.cos(angle) * speed;
  cue.vy = Math.sin(angle) * speed;
  return { ...state, balls, shots: state.shots + 1, moving: true };
}

export function isMoving(state) {
  return state.balls.some((item) => !item.potted && (Math.abs(item.vx) > 0.05 || Math.abs(item.vy) > 0.05));
}

export function respotCue(state) {
  let x = 250;
  let y = 250;
  for (let attempt = 0; attempt < 40; attempt++) {
    const blocked = state.balls.some(
      (item) => item.id !== 'cue' && !item.potted && Math.hypot(item.x - x, item.y - y) < item.r * 2.4,
    );
    if (!blocked) break;
    x = 140 + Math.random() * 220;
    y = 120 + Math.random() * 260;
  }
  const balls = state.balls.map((item) =>
    item.id === 'cue' ? { ...item, x, y, vx: 0, vy: 0, potted: false } : { ...item },
  );
  return { ...state, balls };
}

export function step(state) {
  const balls = state.balls.map((item) => ({ ...item }));
  const potted = [];
  const minX = TABLE.cushion + TABLE.ballR;
  const maxX = TABLE.w - TABLE.cushion - TABLE.ballR;
  const minY = TABLE.cushion + TABLE.ballR;
  const maxY = TABLE.h - TABLE.cushion - TABLE.ballR;

  for (const item of balls) {
    if (item.potted) continue;
    item.x += item.vx;
    item.y += item.vy;
    item.vx *= 0.992;
    item.vy *= 0.992;
    if (Math.abs(item.vx) < 0.06) item.vx = 0;
    if (Math.abs(item.vy) < 0.06) item.vy = 0;

    if (item.x < minX) {
      item.x = minX;
      item.vx = -item.vx * 0.92;
    } else if (item.x > maxX) {
      item.x = maxX;
      item.vx = -item.vx * 0.92;
    }
    if (item.y < minY) {
      item.y = minY;
      item.vy = -item.vy * 0.92;
    } else if (item.y > maxY) {
      item.y = maxY;
      item.vy = -item.vy * 0.92;
    }

    for (const pocket of POCKETS) {
      if (Math.hypot(item.x - pocket.x, item.y - pocket.y) < TABLE.pocketR) {
        item.potted = true;
        item.vx = 0;
        item.vy = 0;
        potted.push(item.id);
        break;
      }
    }
  }

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.potted) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (b.potted) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = a.r + b.r;
        if (dist === 0 || dist >= minDist) continue;
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = (minDist - dist) / 2;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;
        const va = a.vx * nx + a.vy * ny;
        const vb = b.vx * nx + b.vy * ny;
        if (va - vb <= 0) continue;
        const impulse = ((1 + 0.96) / 2) * (va - vb);
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;
      }
    }
  }

  const nextState = { ...state, balls, lastPotted: potted, moving: isMoving({ ...state, balls }) };
  return { state: nextState, lastPotted: potted, moving: nextState.moving };
}

export function remainingObjects(state) {
  return state.balls.filter((item) => item.id !== 'cue' && !item.potted).length;
}
