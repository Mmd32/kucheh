// هوش مصنوعی شطرنج: negamax با alpha-beta و جست‌وجوی آرام.

import { legalMoves, makeMove, isInCheck, opposite } from './engine.js';

const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

const KNIGHT_TABLE = [
  -5, -4, -3, -3, -3, -3, -4, -5,
  -4, -2, 0, 0, 0, 0, -2, -4,
  -3, 0, 1, 2, 2, 1, 0, -3,
  -3, 0, 2, 3, 3, 2, 0, -3,
  -3, 1, 2, 3, 3, 2, 1, -3,
  -3, 0, 2, 2, 2, 2, 0, -3,
  -4, -2, 0, 1, 1, 0, -2, -4,
  -5, -4, -3, -3, -3, -3, -4, -5,
];

const PAWN_TABLE = [
  0, 0, 0, 0, 0, 0, 0, 0,
  5, 10, 10, -20, -20, 10, 10, 5,
  5, -5, -10, 0, 0, -10, -5, 5,
  0, 0, 0, 20, 20, 0, 0, 0,
  5, 5, 10, 25, 25, 10, 5, 5,
  10, 10, 20, 30, 30, 20, 10, 10,
  50, 50, 50, 50, 50, 50, 50, 50,
  0, 0, 0, 0, 0, 0, 0, 0,
];

export const LEVELS = { easy: { depth: 1, noise: 260 }, medium: { depth: 2, noise: 0 }, hard: { depth: 3, noise: 0 } };

// امتیاز از دید سفید
export function evaluate(state) {
  let score = 0;
  const board = state.board;
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p) continue;
    const lower = p.toLowerCase();
    const sign = p === p.toUpperCase() ? 1 : -1;
    let bonus = 0;
    if (lower === 'n') bonus = KNIGHT_TABLE[i];
    else if (lower === 'p') bonus = PAWN_TABLE[i];
    score += sign * (VALUE[lower] + bonus);
  }
  return score;
}

function evalFor(state, color) {
  const s = evaluate(state);
  return color === 'w' ? s : -s;
}

function scoreMove(state, move) {
  let s = 0;
  if (move.captured) s += 10 * VALUE[move.captured.toLowerCase()] - VALUE[move.piece.toLowerCase()];
  if (move.promotion) s += 800;
  if (move.flags && move.flags.castle) s += 40;
  return s;
}

function orderMoves(state, moves) {
  return moves.slice().sort((a, b) => scoreMove(state, b) - scoreMove(state, a));
}

function quiescence(state, alpha, beta, deadline, depth) {
  const stand = evalFor(state, state.turn);
  if (depth >= 3 || Date.now() > deadline) return stand;
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;

  const moves = orderMoves(
    state,
    legalMoves(state).filter((m) => m.captured || m.promotion),
  );

  for (const move of moves) {
    const next = makeMove(state, move);
    const score = -quiescence(next, -beta, -alpha, deadline, depth + 1);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(state, depth, alpha, beta, deadline, ply) {
  const moves = legalMoves(state);
  if (!moves.length) {
    return isInCheck(state) ? -100000 + ply : 0;
  }
  if (depth <= 0 || Date.now() > deadline) {
    return quiescence(state, alpha, beta, deadline, 0);
  }

  let best = -Infinity;
  for (const move of orderMoves(state, moves)) {
    const next = makeMove(state, move);
    const score = -negamax(next, depth - 1, -beta, -alpha, deadline, ply + 1);
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
    if (Date.now() > deadline) break;
  }
  return best;
}

export function chooseMove(state, { level = 'medium', timeMs = 600, rng = Math.random } = {}) {
  const moves = legalMoves(state);
  if (!moves.length) return null;
  const config = LEVELS[level] || LEVELS.medium;
  const deadline = Date.now() + timeMs;

  let best = null;
  let bestScore = -Infinity;

  for (const move of orderMoves(state, moves)) {
    const next = makeMove(state, move);
    let score = -negamax(next, config.depth - 1, -Infinity, Infinity, deadline, 1);
    if (config.noise) score += (rng() - 0.5) * config.noise;
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
    if (Date.now() > deadline) break;
  }

  return best || moves[Math.floor(rng() * moves.length)];
}

export { evalFor, opposite };
