import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, draw, isOver, legalEdges, boxComplete, totalEdges } from '../src/games/dots/engine.js';
import { SIZE, LADDERS, SNAKES, applyRoll, displayPos, numberAt, jump } from '../src/games/snakes/engine.js';
import { createGame, legalMoves, applyMove, startRoll, capturesAt, GOAL, TRACK } from '../src/games/manch/engine.js';

test('نقطه‌بازی: بستن خانه نوبت را حفظ می‌کند', () => {
  const state = createState(1, 1);
  const edges = legalEdges(state);
  assert.equal(edges.length, totalEdges(state));
  const a = draw(state, { type: 'h', r: 0, c: 0 });
  assert.equal(a.gained, 0);
  assert.equal(a.state.turn, 1);
  const b = draw(a.state, { type: 'v', r: 0, c: 0 });
  const c = draw(b.state, { type: 'h', r: 1, c: 0 });
  const d = draw(c.state, { type: 'v', r: 0, c: 1 });
  assert.equal(d.gained, 1);
  assert.equal(d.state.turn, c.state.turn);
  assert.ok(boxComplete(d.state, 0, 0));
  assert.ok(isOver(d.state));
});

test('نقطه‌بازی: خانه‌ی تکراری رد می‌شود', () => {
  const state = createState(2, 2);
  const res = draw(state, { type: 'h', r: 0, c: 0 });
  assert.equal(draw(res.state, { type: 'h', r: 0, c: 0 }), null);
});

test('مار و پله: نگاشت خانه‌ها درست است', () => {
  assert.deepEqual(displayPos(1), { x: 9, y: 9 });
  assert.deepEqual(displayPos(10), { x: 0, y: 9 });
  assert.deepEqual(displayPos(11), { x: 0, y: 8 });
  assert.deepEqual(displayPos(100), { x: 9, y: 0 });
  assert.deepEqual(displayPos(91), { x: 0, y: 0 });
  for (let dr = 0; dr < SIZE; dr++) {
    for (let dc = 0; dc < SIZE; dc++) {
      const n = numberAt(dr, dc);
      assert.deepEqual(displayPos(n), { x: dc, y: dr }, `خانه ${n}`);
    }
  }
  assert.equal(jump(2), 23);
  assert.equal(jump(98), 79);
  assert.equal(jump(3), 3);
  for (const [from, to] of LADDERS) assert.ok(to > from);
  for (const [from, to] of SNAKES) assert.ok(to < from);
});

test('مار و پله: فراتر از صد نمی‌رود', () => {
  assert.equal(applyRoll(96, 6).pos, 96);
  assert.equal(applyRoll(98, 2).pos, 100);
  assert.equal(applyRoll(1, 1).pos, 23);
  assert.equal(applyRoll(2, 1).pos, 3);
});

test('منچ: شش لازم برای خروج و تاس مجدد', () => {
  const game = createGame(1);
  assert.equal(legalMoves(game, 5).length, 0);
  const six = startRoll(game, 6);
  assert.equal(six.moves.length, 4);
  const after = applyMove(six.game, six.moves[0], 6);
  assert.equal(after.pieces[0][0], 0);
  assert.equal(after.turn, 0, 'با شش نوبت عوض نمی‌شود');
});

test('منچ: زدن مهره‌ی حریف و رفتنش به حیاط', () => {
  const game = createGame(1);
  game.pieces[0][0] = 4;
  game.pieces[1][0] = 44; // 13 + 44 = 57 % 52 = 5
  assert.deepEqual(capturesAt(game, 0, 5), [{ player: 1, piece: 0 }]);
  const after = applyMove(game, { piece: 0, from: 4, to: 5 }, 1);
  assert.equal(after.pieces[1][0], -1);
  assert.equal(after.turn, 0, 'زدن نوبت مجدد می‌دهد');
});

test('منچ: رسیدن به خانه‌ی آخر', () => {
  const game = createGame(1);
  game.pieces[0] = [54, 54, 54, 54];
  const moves = legalMoves(game, 3);
  assert.equal(moves.length, 4);
  assert.equal(moves[0].to, GOAL);
  assert.equal(GOAL, TRACK + 5);
  const after = applyMove(game, moves[0], 3);
  assert.equal(after.pieces[0][0], GOAL);
  assert.equal(after.turn, 0);
});
