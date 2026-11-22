import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, countSolutions, solve, conflicts } from '../src/games/sudoku/engine.js';
import { CROSSWORDS } from '../src/data/puzzles-crossword.js';
import { buildPuzzle, validatePuzzle } from '../src/games/crossword/engine.js';
import { HANGMAN_WORDS } from '../src/data/words-hangman.js';
import { HEADSUP_DECKS } from '../src/data/words-headsup.js';
import { CHARADES_DECKS } from '../src/data/words-charades.js';
import { ALPHABET, normalizeWord, isSolved, visibleCells, normalizeChar } from '../src/games/hangman/engine.js';

test('سودوکو: جدول ساخته‌شده یکتا و حل‌شدنی است', () => {
  const { puzzle, solution } = generate('easy', { maxMs: 2500 });
  assert.equal(puzzle.length, 81);
  assert.equal(solution.length, 81);
  const filled = puzzle.filter(Boolean).length;
  assert.ok(filled >= 30, `خانه‌های داده‌شده: ${filled}`);
  assert.equal(countSolutions(puzzle, 2), 1);
  assert.deepEqual(solve(puzzle), solution);
  for (let r = 0; r < 9; r++) {
    const row = solution.slice(r * 9, r * 9 + 9);
    assert.equal(new Set(row).size, 9);
  }
  assert.equal([...solution].sort().join(''), '111111111222222222333333333444444444555555555666666666777777777888888888999999999');
});

test('سودوکو: تضاد تشخیص داده می‌شود', () => {
  const board = Array(81).fill(0);
  board[0] = 5;
  board[1] = 5;
  assert.ok(conflicts(board).size >= 2);
  assert.equal(conflicts(Array(81).fill(0)).size, 0);
});

test('جدول کلمات: داده‌ی همه‌ی جدول‌ها سالم است', () => {
  for (const data of CROSSWORDS) {
    const errors = validatePuzzle(data);
    assert.deepEqual(errors, [], `جدول ${data.id}: ${errors.join(' | ')}`);
    const built = buildPuzzle(data);
    assert.ok(built.entries.every((e) => e.number >= 1));
    for (const entry of built.entries) {
      assert.ok(entry.answer.length >= 2);
      assert.ok(entry.clue.length > 3);
    }
  }
});

test('هنگ‌من: همه‌ی کلمه‌ها با الفبای صفحه‌کلید نوشته می‌شوند', () => {
  for (const { word } of HANGMAN_WORDS) {
    for (const ch of word) {
      if (ch === ' ' || ch === '\u200c') continue;
      assert.ok(ALPHABET.includes(normalizeChar(ch)), `حرف «${ch}» در ${word}`);
    }
  }
  const word = 'کتاب';
  const guessed = new Set(['ک']);
  assert.equal(isSolved(word, guessed), false);
  assert.equal(visibleCells(word, guessed).filter((c) => c.hidden).length, 3);
  for (const ch of normalizeWord(word)) guessed.add(ch);
  assert.equal(isSolved(word, guessed), true);
  assert.equal(normalizeWord('آب'), 'اب');
});

test('داده‌های بازی‌های تیمی کافی و بدون تکرار هستند', () => {
  for (const deck of [...HEADSUP_DECKS, ...CHARADES_DECKS]) {
    assert.ok(deck.words.length >= 10, deck.title);
    assert.equal(new Set(deck.words).size, deck.words.length, `تکرار در ${deck.title}`);
    for (const word of deck.words) assert.ok(word.trim().length > 1, word);
  }
});
