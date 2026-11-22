import test from 'node:test';
import assert from 'node:assert/strict';
import { games } from '../src/games/registry.js';
import {
  emptyBoard,
  randomBoard,
  fireAt,
  allSunk,
  cellsFor,
  canPlace,
  createAi,
  aiNextShot,
  aiRecord,
  FLEET,
} from '../src/games/battleship/engine.js';

test('هر بیست بازی در فهرست هستند و قالب درست دارند', () => {
  assert.equal(games.length, 20);
  const ids = games.map((g) => g.id);
  assert.equal(new Set(ids).size, 20);
  for (const game of games) {
    assert.ok(game.id, 'id');
    assert.ok(game.title, `${game.id}: title`);
    assert.ok(game.subtitle, `${game.id}: subtitle`);
    assert.ok(game.meta, `${game.id}: meta`);
    assert.ok(game.icon && game.icon.includes('<svg'), `${game.id}: icon`);
    assert.equal(typeof game.mount, 'function', `${game.id}: mount`);
  }
  for (const id of [
    'chess',
    'backgammon',
    'manch',
    'hokm',
    'chaharbarg',
    'blackjack',
    'battleship',
    'snakes',
    'minesweeper',
    'parking',
    'pipes',
    'snake',
    'billiards',
    'dots',
    'tictactoe',
    'sudoku',
    'crossword',
    'hangman',
    'headsup',
    'charades',
  ]) {
    assert.ok(ids.includes(id), id);
  }
});

test('چیدن ناوها و قوانین مجاورت', () => {
  const board = emptyBoard();
  const first = cellsFor(0, 0, 5, 'h');
  assert.ok(canPlace(board, first));
  board.ships.push({ size: 5, cells: first, hits: [] });
  const touching = cellsFor(1, 0, 4, 'h');
  assert.equal(canPlace(board, touching), false, 'ناوها نباید کنار هم باشند');
  const away = cellsFor(5, 0, 4, 'h');
  assert.ok(canPlace(board, away));
  assert.equal(cellsFor(0, 8, 5, 'h'), null);
});

test('چیدن تصادفی پنج ناو سالم می‌سازد', () => {
  for (let i = 0; i < 5; i++) {
    const board = randomBoard();
    assert.equal(board.ships.length, FLEET.length);
    const cells = board.ships.flatMap((s) => s.cells);
    assert.equal(new Set(cells).size, cells.length, 'هم‌پوشانی');
    assert.deepEqual(board.ships.map((s) => s.size).sort((a, b) => a - b), [...FLEET].sort((a, b) => a - b));
  }
});

test('شلیک، اصابت، غرق و پیام تکرار', () => {
  const board = emptyBoard();
  board.ships.push({ size: 2, cells: [0, 1], hits: [] });
  const first = fireAt(board, 0);
  assert.equal(first.result, 'hit');
  assert.equal(allSunk(first.target), false);
  const second = fireAt(first.target, 1);
  assert.equal(second.result, 'sunk');
  assert.equal(allSunk(second.target), true);
  assert.equal(fireAt(second.target, 1).result, 'repeat');
  assert.equal(fireAt(second.target, 50).result, 'miss');
});

test('حافظه‌ی کامپیوتر بعد از اصابت اطراف را هدف می‌گیرد', () => {
  const ai = createAi();
  aiRecord(ai, 44, 'hit', null);
  const choices = new Set();
  for (let i = 0; i < 40; i++) {
    const shot = aiNextShot(ai);
    choices.add(shot);
    ai.shots.add(shot);
  }
  assert.ok([34, 54, 43, 45].some((n) => choices.has(n)));
});
