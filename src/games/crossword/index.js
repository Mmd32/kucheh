import { h, btn, segmented, openModal, toast } from '../../core/ui.js';
import { faNum } from '../../core/i18n.js';
import { play } from '../../core/sound.js';
import { CROSSWORDS } from '../../data/puzzles-crossword.js';
import { buildPuzzle } from './engine.js';

const LETTERS = [...'ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی'];
const BASE = 'آا';

export default {
  id: 'crossword',
  title: 'جدول کلمات',
  subtitle: 'کلمه‌ها را از سرنخ‌ها پیدا کن',
  meta: 'یک‌نفره · ۳ جدول',
  keywords: ['جدول', 'کلمات', 'متقاطع'],
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9.2h6.4M9.9 3.5v5.7M9.9 9.2h10.6M15.4 20.5v-6M9.9 14.5h5.5M15.4 9.2v5.3"/></svg>',
  mount(root, ctx) {
    let puzzle;
    let values = [];
    let selected = null;
    let direction = 'across';
    let wrong = new Set();
    let locked = false;
    let level = 'easy';
    let reveals = 0;
    const REVEAL_LIMIT = { easy: Infinity, medium: 3, hard: 0 };

    const levelControl = segmented(
      [
        { value: 'easy', label: 'آسان' },
        { value: 'medium', label: 'معمولی' },
        { value: 'hard', label: 'سخت' },
      ],
      {
        value: level,
        label: 'سطح',
        onChange: (v) => {
          level = v;
          const pool = CROSSWORDS.filter((item) => (level === 'hard' ? item.rows >= 6 : item.rows < 6));
          const current = pool.find((item) => item.id === puzzle.id);
          load(current || pool[Math.floor(Math.random() * pool.length)] || CROSSWORDS[0]);
        },
      },
    );

    const statusEl = h('div', { class: 'game-status', role: 'status' });
    const gridEl = h('div', { class: 'xw-board', role: 'grid' });
    const cluesEl = h('div', { class: 'xw-clues' });
    const padEl = h('div', { class: 'xw-pad', role: 'group', 'aria-label': 'حروف' });
    const revealBtn = btn('نمایش پاسخ', { variant: 'soft', onClick: () => reveal() });

    const puzzleControl = segmented(
      CROSSWORDS.map((p) => ({ value: p.id, label: p.title })),
      {
        value: CROSSWORDS[0].id,
        label: 'جدول',
        onChange: (id) => {
          const match = CROSSWORDS.find((p) => p.id === id);
          if (match) load(match);
        },
      },
    );

    function load(data) {
      puzzle = buildPuzzle(data);
      values = Array(puzzle.rows * puzzle.cols).fill('');
      wrong = new Set();
      locked = false;
      reveals = 0;
      const first = puzzle.entries.find((e) => e.dir === 'across') || puzzle.entries[0];
      selected = first.cells[0];
      direction = first.dir;
      render();
      ctx.save({ id: puzzle.id, values });
    }

    function keyOf(cell) {
      return cell.r * puzzle.cols + cell.c;
    }

    function currentEntry() {
      if (!selected) return null;
      const match = puzzle.entries.find(
        (e) => e.dir === direction && e.cells.some((cell) => cell.r === selected.r && cell.c === selected.c),
      );
      if (match) return match;
      return puzzle.entries.find((e) => e.cells.some((cell) => cell.r === selected.r && cell.c === selected.c)) || null;
    }

    function entriesAt(r, c) {
      return puzzle.entries.filter((e) => e.cells.some((cell) => cell.r === r && cell.c === c));
    }

    function select(r, c, dirHint = null) {
      const options = entriesAt(r, c);
      if (!options.length) return;
      let dir = dirHint || direction;
      if (!options.some((e) => e.dir === dir)) dir = options[0].dir;
      selected = { r, c };
      direction = dir;
      wrong.clear();
      render();
    }

    function render() {
      if (!puzzle) return;
      const active = currentEntry();
      const activeCells = new Set(active ? active.cells.map((cell) => `${cell.r},${cell.c}`) : []);

      const cells = [];
      for (let r = 0; r < puzzle.rows; r++) {
        for (let c = 0; c < puzzle.cols; c++) {
          const letter = puzzle.grid[r][c];
          if (!letter) {
            cells.push(h('div', { class: 'xw-cell is-black', 'aria-hidden': 'true' }));
            continue;
          }
          const number = puzzle.numbers.get(`${r},${c}`);
          const value = values[r * puzzle.cols + c] || '';
          const cls = ['xw-cell'];
          if (activeCells.has(`${r},${c}`)) cls.push('is-active');
          if (selected && selected.r === r && selected.c === c) cls.push('is-selected');
          if (wrong.has(`${r},${c}`)) cls.push('is-wrong');
          const cell = h(
            'button',
            {
              type: 'button',
              class: cls.join(' '),
              role: 'gridcell',
              'aria-label': `خانه ردیف ${faNum(r + 1)} ستون ${faNum(c + 1)}${value ? `، ${value}` : ''}`,
              onClick: () => {
                if (selected && selected.r === r && selected.c === c) {
                  const options = entriesAt(r, c);
                  if (options.length > 1) {
                    direction = direction === 'across' ? 'down' : 'across';
                    render();
                  }
                } else {
                  select(r, c);
                }
              },
            },
            number ? h('span', { class: 'xw-num', text: faNum(number) }) : null,
            h('span', { class: 'xw-letter', text: value }),
          );
          cells.push(cell);
        }
      }
      gridEl.style.setProperty('--cols', String(puzzle.cols));
      gridEl.replaceChildren(...cells);

      cluesEl.replaceChildren(
        ...[
          ['across', 'افقی'],
          ['down', 'عمودی'],
        ].map(([dir, label]) =>
          h(
            'div',
            { class: 'xw-clue-group' },
            h('h3', { class: 'xw-clue-title', text: label }),
            ...puzzle.entries
              .filter((e) => e.dir === dir)
              .sort((a, b) => a.number - b.number)
              .map((e) =>
                h(
                  'button',
                  {
                    type: 'button',
                    class: `xw-clue ${active === e ? 'is-active' : ''} ${wrong.size && isEntryWrong(e) ? 'is-wrong' : ''}`.trim(),
                    onClick: () => {
                      selected = e.cells[0];
                      direction = e.dir;
                      wrong.clear();
                      render();
                    },
                  },
                  h('span', { class: 'xw-clue-num', text: `${faNum(e.number)}.` }),
                  h('span', { class: 'xw-clue-text', text: e.clue }),
                  h('span', { class: 'xw-clue-len', text: `${faNum(e.answer.length)}` }),
                ),
              ),
          ),
        ),
      );

      revealBtn.classList.toggle('hidden', level === 'hard');
      revealBtn.disabled = level !== 'easy' && reveals >= REVEAL_LIMIT[level];
      revealBtn.textContent = level === 'medium' ? `نمایش پاسخ (${faNum(Math.max(0, REVEAL_LIMIT.medium - reveals))})` : 'نمایش پاسخ';

      padEl.replaceChildren(
        ...LETTERS.map((letter) =>
          h('button', { type: 'button', class: 'xw-key', text: letter, 'aria-label': `حرف ${letter}`, onClick: () => type(letter) }),
        ),
        h('button', { type: 'button', class: 'xw-key xw-key-wide', text: 'پاک', onClick: () => erase() }),
      );

      const filled = values.filter(Boolean).length;
      const total = puzzle.grid.flat().filter(Boolean).length;
      const progress = `${faNum(filled)} از ${faNum(total)} حرف`;
      statusEl.textContent = active
        ? `${direction === 'across' ? 'افقی' : 'عمودی'} ${faNum(active.number)} — ${active.clue} (${faNum(active.answer.length)} حرف) · ${progress}`
        : `یک خانه را انتخاب کن · ${progress}`;
    }

    function isEntryWrong(entry) {
      return entry.cells.some((cell) => wrong.has(`${cell.r},${cell.c}`));
    }

    function type(letter) {
      if (!selected || locked) return;
      values[selected.r * puzzle.cols + selected.c] = letter;
      wrong.delete(`${selected.r},${selected.c}`);
      play('click');
      const entry = currentEntry();
      if (entry) {
        const idx = entry.cells.findIndex((cell) => cell.r === selected.r && cell.c === selected.c);
        const next = entry.cells[idx + 1] || entry.cells[0];
        selected = { r: next.r, c: next.c };
      }
      persist();
      render();
      checkSolved();
    }

    function erase() {
      if (!selected || locked) return;
      values[selected.r * puzzle.cols + selected.c] = '';
      wrong.delete(`${selected.r},${selected.c}`);
      persist();
      render();
    }

    function persist() {
      ctx.save({ id: puzzle.id, values });
    }

    function checkSolved() {
      const complete = puzzle.entries.every((entry) =>
        entry.cells.every((cell, i) => {
          const v = values[cell.r * puzzle.cols + cell.c];
          return v && v === entry.answer[i];
        }),
      );
      if (!complete) return;
      locked = true;
      ctx.clearSave();
      ctx.record('win');
      play('win');
      openModal({
        title: 'جدول کامل شد',
        body: h('p', { text: 'همه‌ی کلمه‌ها درست چیده شدند.' }),
        actions: [{ label: 'بستن', variant: 'primary' }],
      });
    }

    function check() {
      wrong = new Set();
      for (const entry of puzzle.entries) {
        entry.cells.forEach((cell, i) => {
          const value = values[cell.r * puzzle.cols + cell.c];
          if (value && value !== entry.answer[i]) {
            wrong.add(`${cell.r},${cell.c}`);
          }
        });
      }
      if (!wrong.size) {
        toast('تا اینجا همه‌ی حروف درست‌اند');
        play('correct');
      } else {
        toast(`${faNum(wrong.size)} حرف اشتباه است`);
        play('wrong');
      }
      render();
    }

    function reveal() {
      const entry = currentEntry();
      if (!entry) return;
      const limit = REVEAL_LIMIT[level];
      if (reveals >= limit) {
        toast(level === 'hard' ? 'در سطح سخت اجازه‌ی نمایش پاسخ نیست' : 'سهمیه‌ی نمایش پاسخ تمام شد');
        return;
      }
      reveals += 1;
      entry.cells.forEach((cell, i) => {
        values[cell.r * puzzle.cols + cell.c] = entry.answer[i];
        wrong.delete(`${cell.r},${cell.c}`);
      });
      toast(`پاسخ ${faNum(entry.number)}: ${entry.answer}`);
      persist();
      render();
      checkSolved();
    }

    function onKey(e) {
      if (locked) return;
      if (document.querySelector('.modal-backdrop')) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        erase();
        return;
      }
      if (e.key.length === 1 && LETTERS.includes(e.key)) {
        e.preventDefault();
        type(e.key);
      }
    }
    document.addEventListener('keydown', onKey);

    root.append(
      h(
        'div',
        { class: 'game' },
        h('div', { class: 'game-bar' }, h('div', { class: 'bar-group' }, puzzleControl, levelControl), h('div', { class: 'bar-group' }, btn('بررسی', { variant: 'soft', onClick: check }), revealBtn, btn('شروع دوباره', { variant: 'ghost', onClick: () => load(CROSSWORDS.find((p) => p.id === puzzle.id) || CROSSWORDS[0]) }))),
        statusEl,
        h('div', { class: 'game-body xw-layout' }, gridEl, cluesEl, padEl),
      ),
    );

    const saved = ctx.load();
    const savedPuzzle = saved && CROSSWORDS.find((p) => p.id === saved.id);
    if (savedPuzzle) {
      puzzle = buildPuzzle(savedPuzzle);
      values = Array.isArray(saved.values) && saved.values.length === puzzle.rows * puzzle.cols ? saved.values : Array(puzzle.rows * puzzle.cols).fill('');
      const first = puzzle.entries.find((e) => e.dir === 'across') || puzzle.entries[0];
      selected = first.cells[0];
      direction = first.dir;
      render();
      toast('جدول قبلی ادامه پیدا کرد');
    } else {
      load(CROSSWORDS[0]);
    }

    return () => {
      document.removeEventListener('keydown', onKey);
    };
  },
};
