import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  legalMoves,
  makeMove,
  perft,
  gameStatus,
  toSan,
  fromFen,
  toFen,
  isInCheck,
} from '../src/games/chess/engine.js';

test('perft از موقعیت شروع', () => {
  const state = createInitialState();
  assert.equal(perft(state, 1), 20);
  assert.equal(perft(state, 2), 400);
  assert.equal(perft(state, 3), 8902);
});

test('perft از موقعیت کیوی‌پیته', () => {
  const state = fromFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
  assert.equal(perft(state, 1), 48);
  assert.equal(perft(state, 2), 2039);
});

test('perft از موقعیت سوم', () => {
  const state = fromFen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');
  assert.equal(perft(state, 1), 14);
  assert.equal(perft(state, 2), 191);
  assert.equal(perft(state, 3), 2812);
});

test('قلعه‌رفتن هر دو طرف مجاز است', () => {
  const state = fromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const moves = legalMoves(state);
  const short = moves.find((m) => m.flags.castle === 'k');
  const long = moves.find((m) => m.flags.castle === 'q');
  assert.ok(short);
  assert.ok(long);
  const after = makeMove(state, short);
  assert.equal(after.board[62], 'K');
  assert.equal(after.board[61], 'R');
  assert.equal(after.board[63], null);
});

test('آن‌پاسان و ارتقا', () => {
  const epState = fromFen('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
  const ep = legalMoves(epState).find((m) => m.flags.ep);
  assert.ok(ep);
  assert.equal(ep.to, 19);
  const after = makeMove(epState, ep);
  assert.equal(after.board[27], null);

  const promoState = fromFen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
  const promos = legalMoves(promoState).filter((m) => m.from === 8);
  assert.equal(promos.length, 4);
});

test('کیش و مات در چهار حرکت', () => {
  let state = createInitialState();
  for (const [from, to] of [
    [53, 45],
    [12, 28],
    [54, 38],
    [3, 39],
  ]) {
    const move = legalMoves(state).find((m) => m.from === from && m.to === to);
    assert.ok(move, `حرکت ${from}-${to}`);
    const san = toSan(state, move);
    if (from === 3) assert.equal(san, 'Qh4#');
    state = makeMove(state, move);
  }
  assert.equal(gameStatus(state), 'checkmate');
  assert.ok(isInCheck(state));
});

test('پات', () => {
  const state = fromFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  assert.equal(gameStatus(state), 'stalemate');
});

test('FEN رفت و برگشت', () => {
  const state = createInitialState();
  assert.equal(toFen(state), 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const again = fromFen(toFen(state));
  assert.equal(toFen(again), toFen(state));
  assert.equal(legalMoves(again).length, 20);
});
