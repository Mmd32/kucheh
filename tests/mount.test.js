import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';

const { document } = installDom();

const { games } = await import('../src/games/registry.js');
const { applySettings } = await import('../src/core/store.js');
applySettings();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeCtx() {
  const saved = new Map();
  return {
    navigate() {},
    toast() {},
    play() {},
    save(value) {
      saved.set('game', value);
    },
    load() {
      return saved.get('game') || null;
    },
    clearSave() {
      saved.delete('game');
    },
    record() {},
    stat() {
      return null;
    },
    exit() {},
  };
}

function mountGame(game) {
  const root = document.createElement('main');
  document.body.append(root);
  const cleanup = game.mount(root, makeCtx());
  return { root, cleanup };
}

const expectations = {
  chess: { selector: '.chess-sq', min: 64 },
  dots: { selector: '.dots-board', min: 1 },
  snakes: { selector: '.snake-cell', min: 100 },
  battleship: { selector: '.bs-cell', min: 200 },
  tictactoe: { selector: '.ttt-cell', min: 9 },
  crossword: { selector: '.xw-cell', min: 10 },
  hangman: { selector: '.key', min: 32 },
  manch: { selector: '.mtoken', min: 16 },
  backgammon: { selector: '.bg-checker', min: 30 },
  minesweeper: { selector: '.ms-cell', min: 81 },
  parking: { selector: '.park-car', min: 5 },
  pipes: { selector: '.pipe-cell', min: 36 },
  snake: { selector: '.snake-cell', min: 200 },
  hokm: { selector: '.pcard', min: 20 },
  chaharbarg: { selector: '.pcard', min: 20 },
  billiards: { selector: 'canvas', min: 1 },
};

for (const game of games) {
  test(`صفحه‌ی «${game.title}» بدون خطا باز می‌شود`, async () => {
    const { root, cleanup } = mountGame(game);
    if (game.id === 'sudoku') await delay(900);
    assert.ok(root.childNodes.length > 0, `${game.id}: چیزی رندر نشد`);

    const expectation = expectations[game.id];
    if (expectation) {
      const found = root.querySelectorAll(expectation.selector).length;
      assert.ok(found >= expectation.min, `${game.id}: ${expectation.selector} — ${found} (انتظار ${expectation.min})`);
    }

    if (game.id === 'sudoku') {
      const cells = root.querySelectorAll('.sudoku-cell').length;
      assert.equal(cells, 81, 'جدول سودوکو باید ۸۱ خانه داشته باشد');
    }

    if (game.id === 'headsup' || game.id === 'charades') {
      assert.ok(root.textContent.includes('شروع بازی'), `${game.id}: دکمه‌ی شروع نیست`);
    }

    if (typeof cleanup === 'function') cleanup();
    root.remove();
  });
}

test('عدم وجود خطای رندر در متن صفحه‌ها', () => {
  for (const game of games) {
    const { root, cleanup } = mountGame(game);
    assert.ok(!root.textContent.includes('این بازی با خطا باز نشد'), game.id);
    if (typeof cleanup === 'function') cleanup();
    root.remove();
  }
});
