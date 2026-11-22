import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';

const { localStorage } = installDom();
const store = await import('../src/core/store.js');
const { createState } = await import('../src/games/dots/engine.js');

test('ذخیره و خواندن بازی با نسخه و اعتبارسنجی', () => {
  store.saveGame('dots', createState(5, 5));
  const loaded = store.loadGame('dots');
  assert.ok(loaded, 'بازی سالم باید خوانده شود');

  localStorage.setItem('bazikhaneh.v1.saves', JSON.stringify({
    dots: { ts: Date.now(), v: 2, data: { h: [], v: [], boxes: [], scores: [], turn: 9 } },
  }));
  assert.equal(store.loadGame('dots'), null, 'داده‌ی نامعتبر باید دور ریخته شود');

  localStorage.setItem('bazikhaneh.v1.saves', JSON.stringify({
    chess: { ts: Date.now(), v: 1, data: { fen: 'x' } },
  }));
  assert.equal(store.loadGame('chess'), null, 'نسخه‌ی قدیمی باید دور ریخته شود');
});

test('صادر و واردکردن داده‌ها', () => {
  store.recordStat('chess', 'win');
  store.saveGame('crossword', { id: 'rain', values: [] });
  const raw = store.exportData();
  const parsed = JSON.parse(raw);
  assert.equal(parsed.app, 'kucheh');
  assert.ok(parsed.schema >= 1);

  store.clearAllSaves();
  store.clearStats();
  assert.equal(store.loadGame('crossword'), null);

  const result = store.importData(raw);
  assert.equal(result.ok, true, result.reason);
  assert.ok(store.loadGame('crossword'), 'ذخیره باید بازگردد');
  assert.equal(store.getStat('chess').wins, 1);
});

test('ورودی‌های ناسالم رد می‌شوند', () => {
  assert.equal(store.importData('not json').ok, false);
  assert.equal(store.importData('{"app":"other"}').ok, false);
  assert.equal(store.importData('{"app":"kucheh","schema":999}').ok, false);

  const dirty = {
    app: 'kucheh',
    schema: 2,
    settings: { themes: 'nope', numerals: 'xx', boardScale: 50, playerName: 'x'.repeat(80), sound: 'yes' },
    stats: { '../evil': { wins: 3 }, chess: { wins: -5, best: 'many' } },
    saves: { '../../x': { data: {} }, sudoku: { data: { entries: [] } } },
  };
  const result = store.importData(dirty);
  assert.equal(result.ok, true);
  const settings = store.getSettings();
  assert.equal(settings.numerals, 'fa');
  assert.equal(settings.boardScale, 1);
  assert.equal(settings.playerName.length, 20);
  const stats = store.getStats();
  assert.equal(stats['../evil'], undefined);
  assert.equal(store.getStat('chess').wins, 0);
  assert.equal(store.loadGame('sudoku'), null);
});

test('تنظیمات پس از بازیابی روی سند اعمال می‌شود', () => {
  store.setSetting('theme', 'dark');
  store.setSetting('motion', 'reduced');
  store.setSetting('boardScale', 1.15);
  store.applySettings();
  assert.equal(globalThis.document.documentElement.dataset.theme, 'dark');
  assert.equal(globalThis.document.documentElement.dataset.motion, 'reduced');
});
