// منچ: چهار بازیکن، چهار مهره، مسیر ۵۲ خانه‌ای و راه خانه.

export const TRACK = 52;
export const HOME_CELLS = 5;
export const GOAL = TRACK + HOME_CELLS; // 57
export const STARTS = [0, 13, 26, 39];
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export function createGame(humanCount = 1) {
  const seats = Array.from({ length: 4 }, (_, i) => ({
    kind: i < humanCount ? 'human' : 'ai',
    name: i < humanCount ? (humanCount === 1 ? 'تو' : `بازیکن ${i + 1}`) : `کامپیوتر ${i + 1 - humanCount}`,
  }));
  return {
    seats,
    pieces: seats.map(() => Array(4).fill(-1)),
    turn: 0,
    sixes: 0,
    winner: null,
  };
}

export function cloneGame(game) {
  return {
    seats: game.seats.map((seat) => ({ ...seat })),
    pieces: game.pieces.map((pieces) => pieces.slice()),
    turn: game.turn,
    sixes: game.sixes,
    winner: game.winner,
  };
}

export function legalMoves(game, roll) {
  const player = game.turn;
  const out = [];
  game.pieces[player].forEach((steps, index) => {
    if (steps === -1) {
      if (roll === 6) out.push({ piece: index, from: -1, to: 0 });
    } else if (steps < GOAL && steps + roll <= GOAL) {
      out.push({ piece: index, from: steps, to: steps + roll });
    }
  });
  return out;
}

export function absoluteCell(player, steps) {
  if (steps < 0 || steps > TRACK - 1) return null;
  return (STARTS[player] + steps) % TRACK;
}

export function capturesAt(game, player, to) {
  const cell = absoluteCell(player, to);
  if (cell === null || SAFE.has(cell)) return [];
  const out = [];
  for (let q = 0; q < game.pieces.length; q++) {
    if (q === player) continue;
    game.pieces[q].forEach((steps, index) => {
      if (steps >= 0 && steps <= TRACK - 1 && (STARTS[q] + steps) % TRACK === cell) {
        out.push({ player: q, piece: index });
      }
    });
  }
  return out;
}

export function startRoll(game, roll) {
  const next = cloneGame(game);
  next.sixes = roll === 6 ? next.sixes + 1 : 0;
  if (next.sixes >= 3) {
    next.sixes = 0;
    next.turn = (next.turn + 1) % next.pieces.length;
    return { game: next, skipped: true, roll };
  }
  return { game: next, skipped: false, roll, moves: legalMoves(next, roll) };
}

export function passTurn(game) {
  const next = cloneGame(game);
  next.turn = (next.turn + 1) % next.pieces.length;
  next.sixes = 0;
  return next;
}

export function applyMove(game, move, roll) {
  const next = cloneGame(game);
  const player = game.turn;
  next.pieces[player][move.piece] = move.to;

  const hits = capturesAt(next, player, move.to);
  for (const hit of hits) next.pieces[hit.player][hit.piece] = -1;

  if (next.pieces[player].every((steps) => steps === GOAL)) {
    next.winner = player;
    return next;
  }

  const extra = roll === 6 || hits.length > 0 || move.to === GOAL;
  if (extra) {
    next.turn = player;
  } else {
    next.turn = (player + 1) % next.pieces.length;
    next.sixes = 0;
  }
  return next;
}

function threatCount(game, player, to) {
  const cell = absoluteCell(player, to);
  if (cell === null) return 0;
  let threats = 0;
  for (let q = 0; q < game.pieces.length; q++) {
    if (q === player) continue;
    for (const steps of game.pieces[q]) {
      if (steps < 0 || steps > TRACK - 1) continue;
      const other = (STARTS[q] + steps) % TRACK;
      const distance = (cell - other + TRACK) % TRACK;
      if (distance >= 1 && distance <= 6) threats += 1;
    }
  }
  return threats;
}

export function aiPick(game, roll, level = 'normal') {
  const moves = legalMoves(game, roll);
  if (!moves.length) return null;
  let best = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    let score = 0;
    if (move.from === -1) score += 42;
    if (move.to === GOAL) score += 140;
    score += capturesAt(game, game.turn, move.to).length * 80;
    score += move.to * 0.3;
    const cell = absoluteCell(game.turn, move.to);
    if (cell !== null && SAFE.has(cell)) score += 12;
    score -= threatCount(game, game.turn, move.to) * 5;
    score += Math.random() * (level === 'easy' ? 60 : level === 'hard' ? 1 : 4);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

export function pieceStep(game, player, index) {
  return game.pieces[player][index];
}

export function finishedCount(game, player) {
  return game.pieces[player].filter((s) => s === GOAL).length;
}
