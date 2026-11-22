// تخته نرد: قواعد کامل، حرکت‌های مجاز و انتخاب حرکت برای کامپیوتر.

export const POINTS = 24;
export const PIECES = 15;

export const otherColor = (c) => (c === 'w' ? 'b' : 'w');

export function createState() {
  const points = Array.from({ length: POINTS }, () => null);
  const put = (i, color, n) => {
    points[i] = { color, n };
  };
  put(0, 'w', 2);
  put(11, 'w', 5);
  put(16, 'w', 3);
  put(18, 'w', 5);
  put(23, 'b', 2);
  put(12, 'b', 5);
  put(7, 'b', 3);
  put(5, 'b', 5);
  return { points, bar: { w: 0, b: 0 }, off: { w: 0, b: 0 }, turn: 'w', dice: [] };
}

export function cloneState(state) {
  return {
    points: state.points.map((p) => (p ? { ...p } : null)),
    bar: { ...state.bar },
    off: { ...state.off },
    turn: state.turn,
    dice: state.dice.slice(),
  };
}

export function homeRange(color) {
  return color === 'w' ? [18, 23] : [0, 5];
}

export function hasAllInHome(state, color) {
  if (state.bar[color] > 0) return false;
  const [lo, hi] = homeRange(color);
  for (let i = 0; i < POINTS; i++) {
    const p = state.points[i];
    if (!p || p.color !== color) continue;
    if (i < lo || i > hi) return false;
  }
  return true;
}

export function canLand(state, color, index) {
  if (index < 0 || index > POINTS - 1) return false;
  const p = state.points[index];
  if (!p) return true;
  if (p.color === color) return true;
  return p.n === 1;
}

export function canBearOff(state, color, from, die) {
  if (color === 'w') {
    const dest = from + die;
    if (dest === 24) return true;
    if (dest > 24) {
      for (let i = 23; i > from; i--) {
        const p = state.points[i];
        if (p && p.color === 'w') return false;
      }
      return true;
    }
    return false;
  }
  const dest = from - die;
  if (dest === -1) return true;
  if (dest < -1) {
    for (let i = 0; i < from; i++) {
      const p = state.points[i];
      if (p && p.color === 'b') return false;
    }
    return true;
  }
  return false;
}

export function legalSingles(state) {
  const color = state.turn;
  const dice = [...new Set(state.dice)].sort((a, b) => b - a);
  const moves = [];

  if (state.bar[color] > 0) {
    for (const die of dice) {
      const to = color === 'w' ? die - 1 : 24 - die;
      if (canLand(state, color, to)) moves.push({ from: 'bar', to, die });
    }
    return moves;
  }

  const home = hasAllInHome(state, color);
  for (let i = 0; i < POINTS; i++) {
    const p = state.points[i];
    if (!p || p.color !== color) continue;
    for (const die of dice) {
      const to = color === 'w' ? i + die : i - die;
      if (to >= 0 && to <= 23) {
        if (canLand(state, color, to)) moves.push({ from: i, to, die });
      } else if (home && canBearOff(state, color, i, die)) {
        moves.push({ from: i, to: 'off', die });
      }
    }
  }
  return moves;
}

export function applySingle(state, move) {
  const next = cloneState(state);
  const color = state.turn;

  if (move.from === 'bar') next.bar[color] -= 1;
  else {
    const p = next.points[move.from];
    if (p) {
      p.n -= 1;
      if (p.n <= 0) next.points[move.from] = null;
    }
  }

  if (move.to === 'off') {
    next.off[color] += 1;
  } else {
    const target = next.points[move.to];
    if (target && target.color !== color && target.n === 1) {
      if (target.color === 'w') next.bar.w += 1;
      else next.bar.b += 1;
      next.points[move.to] = null;
    }
    const dest = next.points[move.to];
    if (dest) dest.n += 1;
    else next.points[move.to] = { color, n: 1 };
  }

  const idx = next.dice.indexOf(move.die);
  if (idx >= 0) next.dice.splice(idx, 1);
  if (next.dice.length === 0) {
    next.turn = otherColor(color);
    next.dice = [];
  }

  return next;
}

export function roll(state, values) {
  const next = cloneState(state);
  next.dice = values.slice();
  return next;
}

export function randomRoll(count = 2, rng = Math.random) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(1 + Math.floor(rng() * 6));
  return out;
}

export function passTurn(state) {
  const next = cloneState(state);
  next.turn = otherColor(next.turn);
  next.dice = [];
  return next;
}

export function pipCount(state, color) {
  let pip = state.bar[color] * 25;
  for (let i = 0; i < POINTS; i++) {
    const p = state.points[i];
    if (!p || p.color !== color) continue;
    pip += p.n * (color === 'w' ? 24 - i : i + 1);
  }
  return pip;
}

export function blotCount(state, color) {
  let count = 0;
  for (const p of state.points) {
    if (p && p.color === color && p.n === 1) count += 1;
  }
  return count;
}

export function madePoints(state, color) {
  let count = 0;
  for (const p of state.points) {
    if (p && p.color === color && p.n >= 2) count += 1;
  }
  return count;
}

export function evaluate(state, color) {
  const opp = otherColor(color);
  const pipDiff = pipCount(state, opp) - pipCount(state, color);
  const blotDiff = blotCount(state, opp) - blotCount(state, color);
  const madeDiff = madePoints(state, color) - madePoints(state, opp);
  return pipDiff + blotDiff * 2.2 + madeDiff * 3;
}

export function allTurns(state, limit = 1200) {
  const results = [];

  function walk(st, moves) {
    if (results.length >= limit) return;
    if (!st.dice.length) {
      results.push({ state: st, moves });
      return;
    }
    const singles = legalSingles(st);
    if (!singles.length) {
      results.push({ state: passTurn(st), moves });
      return;
    }
    for (const mv of singles) {
      walk(applySingle(st, mv), [...moves, mv]);
      if (results.length >= limit) return;
    }
  }

  const singles = legalSingles(state);
  if (!singles.length) return [{ state: passTurn(state), moves: [] }];
  for (const mv of singles) {
    walk(applySingle(state, mv), [mv]);
    if (results.length >= limit) break;
  }
  return results;
}

export function bestTurn(state, { level = 'normal' } = {}) {
  const turns = allTurns(state);
  if (!turns.length) return null;
  if (level === 'easy' && Math.random() < 0.3) {
    return turns[Math.floor(Math.random() * turns.length)];
  }
  const color = state.turn;
  let best = turns[0];
  let bestScore = -Infinity;
  for (const turn of turns) {
    let score = evaluate(turn.state, color) + turn.moves.length * 3;
    if (turn.state.off[color] === PIECES) score += 10000;
    if (score > bestScore) {
      bestScore = score;
      best = turn;
    }
  }
  return best;
}

export function hasWon(state, color) {
  return state.off[color] >= PIECES;
}

export function scoreKind(state, winner) {
  const loser = otherColor(winner);
  if (state.off[loser] === 0) return 'backgammon';
  if (state.off[loser] < PIECES) return 'gammon';
  return 'single';
}
