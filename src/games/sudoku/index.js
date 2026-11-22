import { h, btn, segmented, openModal, toast } from '../../core/ui.js';
import { faNum } from '../../core/i18n.js';
import { play } from '../../core/sound.js';
import { generate, conflicts } from './engine.js';

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default {
  id: 'sudoku',
  title: 'سودوکو',
  subtitle: 'هر عدد، یک بار در هر ردیف',
  meta: 'یک‌نفره · ۳ سطح',
  keywords: ['سودوکو', 'جدول', 'اعداد'],
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"/></svg>',
  mount(root, ctx) {
    let state = null;
    let difficulty = 'medium';
    let selected = -1;
    let notesMode = false;
    let wrongSet = new Set();
    let loading = false;
    let interval = null;

    const statusEl = h('div', { class: 'game-status', role: 'status' });
    const boardEl = h('div', { class: 'sudoku-board', role: 'grid', 'aria-label': 'جدول سودوکو' });
    const padEl = h('div', { class: 'sudoku-pad' });
    const metaEl = h('div', { class: 'row small muted' });

    const diffControl = segmented(
      [
        { value: 'easy', label: 'آسان' },
        { value: 'medium', label: 'معمولی' },
        { value: 'hard', label: 'سخت' },
      ],
      {
        value: difficulty,
        label: 'سطح',
        onChange: (v) => {
          difficulty = v;
          newGame();
        },
      },
    );

    const saveState = () => {
      if (!state) return;
      ctx.save({
        puzzle: state.puzzle,
        solution: state.solution,
        entries: state.entries,
        notes: state.notes,
        difficulty: state.difficulty,
        seconds: state.seconds,
        hints: state.hints,
      });
    };

    function restore(saved) {
      if (!saved || !Array.isArray(saved.entries) || saved.entries.length !== 81) return false;
      state = {
        puzzle: saved.puzzle,
        solution: saved.solution,
        entries: saved.entries,
        notes: saved.notes || Array.from({ length: 81 }, () => []),
        difficulty: saved.difficulty || 'medium',
        seconds: saved.seconds || 0,
        hints: saved.hints || 0,
      };
      difficulty = state.difficulty;
      return true;
    }

    function newGame() {
      if (loading) return;
      loading = true;
      finished = false;
      wrongSet = new Set();
      selected = -1;
      state = null;
      boardEl.replaceChildren();
      statusEl.textContent = 'در حال ساخت جدول…';
      setTimeout(() => {
        try {
          const { puzzle, solution } = generate(difficulty);
          state = {
            puzzle,
            solution,
            entries: puzzle.slice(),
            notes: Array.from({ length: 81 }, () => []),
            difficulty,
            seconds: 0,
            hints: 0,
          };
          selected = -1;
          wrongSet = new Set();
          render();
          startClock();
          saveState();
        } catch (err) {
          statusEl.textContent = 'ساخت جدول ممکن نشد؛ دوباره تلاش کن.';
        } finally {
          loading = false;
        }
      }, 40);
    }

    function startClock() {
      if (interval) clearInterval(interval);
      interval = setInterval(() => {
        if (!state) return;
        state.seconds += 1;
        renderMeta();
      }, 1000);
    }

    function renderMeta() {
      if (!state) return;
      const done = state.entries.filter((v, i) => v && v === state.solution[i]).length;
      metaEl.replaceChildren(
        h('span', { text: `زمان: ${faNum(formatTime(state.seconds))}` }),
        h('span', { text: `${faNum(done)} از ${faNum(81)} خانه` }),
        h('span', { text: `راهنما: ${faNum(3 - state.hints)}` }),
      );
    }

    function formatTime(sec) {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${String(s).padStart(2, '0')}`;
    }

    function cellIsGiven(i) {
      return state.puzzle[i] !== 0;
    }

    function render() {
      if (!state) return;
      const sel = selected >= 0 ? selected : -1;
      const selRow = sel >= 0 ? Math.floor(sel / 9) : -1;
      const selCol = sel >= 0 ? sel % 9 : -1;
      const selBox = sel >= 0 ? Math.floor(selRow / 3) * 3 + Math.floor(selCol / 3) : -1;
      const selValue = sel >= 0 ? state.entries[sel] : 0;

      const cells = [];
      for (let i = 0; i < 81; i++) {
        const r = Math.floor(i / 9);
        const c = i % 9;
        const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
        const given = cellIsGiven(i);
        const value = state.entries[i];
        const notes = state.notes[i];
        const classes = ['sudoku-cell'];
        if (given) classes.push('is-given');
        if (value && value === selValue && !given) classes.push('is-same');
        if (!value && sel >= 0 && (r === selRow || c === selCol || b === selBox)) classes.push('is-peer');
        if (i === sel) classes.push('is-selected');
        if (wrongSet.has(i)) classes.push('is-wrong');
        if (c % 3 === 2 && c !== 8) classes.push('box-right');
        if (r % 3 === 2 && r !== 8) classes.push('box-bottom');

        const content = value
          ? h('span', { class: 'sudoku-value', text: faNum(value) })
          : notes.length
            ? h(
                'span',
                { class: 'sudoku-notes', 'aria-hidden': 'true' },
                DIGITS.map((d) => h('span', { class: notes.includes(d) ? 'note is-on' : 'note', text: notes.includes(d) ? faNum(d) : '' })),
              )
            : null;

        const cell = h('button', {
          type: 'button',
          class: classes.join(' '),
          role: 'gridcell',
          'aria-label': `ردیف ${faNum(r + 1)} ستون ${faNum(c + 1)}${value ? `، ${faNum(value)}` : '، خالی'}`,
          onClick: () => select(i),
        });
        if (content) cell.append(content);
        cells.push(cell);
      }
      boardEl.replaceChildren(...cells);
      renderMeta();
      renderPad();

      const remaining = state.entries.filter((v, i) => v === state.solution[i]).length;
      if (remaining === 81 && !loading) {
        finish();
      } else {
        statusEl.innerHTML = notesMode ? 'یادداشت روشن است — عدد را در گوشه ثبت می‌کنی.' : 'یک خانه را انتخاب کن و عدد بزن.';
      }
    }

    function renderPad() {
      const buttons = DIGITS.map((d) =>
        h('button', {
          type: 'button',
          class: 'pad-key',
          text: faNum(d),
          'aria-label': `عدد ${faNum(d)}`,
          onClick: () => enter(d),
        }),
      );
      padEl.replaceChildren(
        ...buttons,
        h('button', { type: 'button', class: 'pad-key pad-erase', text: 'پاک', 'aria-label': 'پاک‌کردن خانه', onClick: () => enter(0) }),
        h(
          'button',
          {
            type: 'button',
            class: `pad-key pad-notes ${notesMode ? 'is-on' : ''}`,
            text: 'یادداشت',
            'aria-pressed': String(notesMode),
            onClick: () => {
              notesMode = !notesMode;
              render();
            },
          },
        ),
      );
    }

    function select(i) {
      selected = i;
      render();
    }

    function enter(value) {
      if (finished) return;
      if (!state || selected < 0) {
        if (!state) return;
        toast('اول یک خانه را انتخاب کن');
        return;
      }
      if (cellIsGiven(selected)) return;
      if (notesMode && value) {
        const list = new Set(state.notes[selected]);
        if (list.has(value)) list.delete(value);
        else list.add(value);
        state.notes[selected] = [...list].sort();
        state.entries[selected] = 0;
      } else {
        state.entries[selected] = value;
        state.notes[selected] = [];
        wrongSet.delete(selected);
        if (value) play('place');
      }
      saveState();
      render();
    }

    function check() {
      if (!state) return;
      wrongSet = new Set();
      let wrongCount = 0;
      for (let i = 0; i < 81; i++) {
        const v = state.entries[i];
        if (v && v !== state.solution[i]) {
          wrongSet.add(i);
          wrongCount += 1;
        }
      }
      const dups = conflicts(state.entries);
      dups.forEach((i) => wrongSet.add(i));
      if (!wrongCount && !dups.size) {
        toast('تا اینجا همه‌چیز درست است');
        play('correct');
      } else {
        toast(`${faNum(wrongCount)} خانه اشتباه است`);
        play('wrong');
      }
      render();
    }

    function hint() {
      if (!state || finished) return;
      if (state.hints >= 3) {
        toast('سه راهنما استفاده شد');
        return;
      }
      const empties = [];
      for (let i = 0; i < 81; i++) {
        if (state.entries[i] !== state.solution[i]) empties.push(i);
      }
      if (!empties.length) return;
      const prefer = selected >= 0 && empties.includes(selected) ? selected : empties[Math.floor(Math.random() * empties.length)];
      state.entries[prefer] = state.solution[prefer];
      state.notes[prefer] = [];
      state.hints += 1;
      wrongSet.delete(prefer);
      selected = prefer;
      play('correct');
      saveState();
      render();
    }

    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      if (interval) clearInterval(interval);
      interval = null;
      ctx.clearSave();
      ctx.record('win');
      play('win');
      openModal({
        title: 'حل شد',
        body: h('p', { text: `جدول را در ${faNum(formatTime(state.seconds))} تمام کردی.` }),
        actions: [
          { label: 'جدول تازه', variant: 'primary', onClick: () => { finished = false; newGame(); } },
          { label: 'بستن', variant: 'ghost' },
        ],
      });
    }

    function onKey(e) {
      if (!state) return;
      if (document.querySelector('.modal-backdrop')) return;
      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        enter(Number(e.key));
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        enter(0);
      } else if (/^[۰-۹]$/.test(e.key)) {
        e.preventDefault();
        enter('۰۱۲۳۴۵۶۷۸۹'.indexOf(e.key) + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (selected < 0) return;
        e.preventDefault();
        const r = Math.floor(selected / 9);
        const c = selected % 9;
        const dr = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
        const dc = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        const nr = Math.min(8, Math.max(0, r + dr));
        const nc = Math.min(8, Math.max(0, c + dc));
        selected = nr * 9 + nc;
        render();
      }
    }

    document.addEventListener('keydown', onKey);

    root.append(
      h(
        'div',
        { class: 'game' },
        h(
          'div',
          { class: 'game-bar' },
          h('div', { class: 'bar-group' }, diffControl, btn('بررسی', { variant: 'soft', onClick: check }), btn('راهنما', { variant: 'soft', onClick: hint })),
          h('div', { class: 'bar-group' }, btn('جدول جدید', { variant: 'ghost', onClick: () => { finished = false; newGame(); } })),
        ),
        statusEl,
        h('div', { class: 'game-body' }, boardEl, padEl, metaEl),
      ),
    );

    if (restore(ctx.load())) {
      finished = false;
      render();
      toast('ادامه‌ی جدول قبلی');
    } else {
      newGame();
    }
    startClock();

    return () => {
      document.removeEventListener('keydown', onKey);
      if (interval) clearInterval(interval);
    };
  },
};
