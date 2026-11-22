import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard, winner, isFull, legalMoves, bestMoves } from '../src/games/tictactoe/engine.js';

function play(board, mark, index) {
  board[index] = mark;
}

test('تشخیص برد در ردیف و ستون', () => {
  const board = createBoard();
  play(board, 'x', 0);
  play(board, 'x', 1);
  play(board, 'x', 2);
  assert.equal(winner(board).mark, 'x');
  assert.deepEqual(winner(board).line, [0, 1, 2]);

  const col = createBoard();
  for (const i of [2, 5, 8]) play(col, 'o', i);
  assert.equal(winner(col).mark, 'o');
});

test('بازی کامل و پر شدن خانه‌ها', () => {
  const board = ['x', 'o', 'x', 'x', 'o', 'o', 'o', 'x', 'x'];
  assert.equal(winner(board), null);
  assert.ok(isFull(board));
});

test('هوش مصنوعی هیچ‌وقت نمی‌بازد', () => {
  function bestForO(board) {
    return bestMoves(board.slice(), 'o');
  }
  function worstCaseX(board, turn) {
    if (winner(board)) return winner(board).mark !== 'x';
    if (isFull(board)) return true;
    if (turn === 'x') {
      return legalMoves(board).every((i) => {
        const next = board.slice();
        next[i] = 'x';
        return worstCaseX(next, 'o');
      });
    }
    // O بی‌نقص بازی می‌کند؛ همه‌ی حرکت‌های بهینه را امتحان کن
    return bestForO(board).some((i) => {
      const next = board.slice();
      next[i] = 'o';
      return worstCaseX(next, 'x');
    });
  }
  for (const first of legalMoves(createBoard())) {
    const board = createBoard();
    board[first] = 'x';
    assert.ok(worstCaseX(board, 'o'), `X از خانه ${first} برد`);
  }
});

test('حرکت‌های موجود فقط خانه‌های خالی هستند', () => {
  const board = ['x', 'o', 'x', '', '', '', '', '', ''];
  assert.deepEqual(legalMoves(board), [3, 4, 5, 6, 7, 8]);
});
