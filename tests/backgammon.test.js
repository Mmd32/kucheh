import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState,
  legalSingles,
  applySingle,
  roll,
  pipCount,
  hasAllInHome,
  passTurn,
  allTurns,
  PIECES,
} from '../src/games/backgammon/engine.js';

test('موقعیت شروع متعادل است', () => {
  const state = createState();
  assert.equal(pipCount(state, 'w'), 167);
  assert.equal(pipCount(state, 'b'), 167);
  assert.equal(state.bar.w, 0);
  assert.equal(state.off.w, 0);
  assert.equal(state.points.filter(Boolean).length, 8);
});

test('تاس و حرکات اولیه', () => {
  const state = roll(createState(), [6, 3]);
  const moves = legalSingles(state);
  assert.ok(moves.length > 0);
  assert.ok(moves.every((m) => m.die === 6 || m.die === 3));
  const doubles = roll(createState(), [4, 4, 4, 4]);
  const turns = allTurns(doubles);
  assert.ok(turns.some((turn) => turn.moves.length === 4), 'با دوبل چهار باید چهار حرکت ممکن باشد');
});

test('مهره روی میله باید اول وارد شود', () => {
  const state = createState();
  state.bar.w = 1;
  state.points[18].n = 4;
  const moves = legalSingles(roll(state, [2, 5]));
  assert.ok(moves.length > 0);
  assert.ok(moves.every((m) => m.from === 'bar'));
  const targets = moves.map((m) => m.to).sort((a, b) => a - b);
  assert.deepEqual(targets, [1, 4]);
});

test('خروج مهره‌ها با تاس دقیق', () => {
  const state = createState();
  for (let i = 0; i < 24; i++) state.points[i] = null;
  state.points[20] = { color: 'w', n: 2 };
  state.points[23] = { color: 'w', n: 3 };
  state.off.w = 10;
  assert.ok(hasAllInHome(state, 'w'));
  const moves = legalSingles(roll(state, [3, 4]));
  assert.ok(moves.some((m) => m.from === 20 && m.to === 'off' && m.die === 4));
  assert.ok(moves.some((m) => m.from === 20 && m.to === 23 && m.die === 3));
});

test('زدن مهره‌ی حریف به میله', () => {
  const state = createState();
  state.points[3] = { color: 'w', n: 1 };
  state.points[5] = { color: 'b', n: 1 };
  const next = applySingle(state, { from: 3, to: 5, die: 2 });
  assert.equal(next.points[5].color, 'w');
  assert.equal(next.bar.b, 1);
});

test('تمام شدن تاس‌ها نوبت را می‌چرخاند و همه‌ی نوبت‌ها تولید می‌شوند', () => {
  const state = roll(createState(), [1, 1, 1, 1]);
  const turns = allTurns(state);
  assert.ok(turns.length > 0);
  const last = turns[0];
  assert.equal(last.state.turn, 'b');
  assert.equal(last.state.dice.length, 0);
  const passed = passTurn(state);
  assert.equal(passed.turn, 'b');
  assert.equal(PIECES, 15);
});
