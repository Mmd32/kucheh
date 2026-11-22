import { h, btn, segmented, openModal } from '../../core/ui.js';
import { faNum } from '../../core/i18n.js';
import { play } from '../../core/sound.js';
import { createBoard, winner, isFull, bestMoves, other } from './engine.js';

const MARKS = { x: '×', o: '○' };

export default {
  id: 'tictactoe',
  title: 'دوز',
  subtitle: 'سه‌تا در یک ردیف',
  meta: 'دو نفره یا کامپیوتر',
  keywords: ['دوز', 'اکس او', 'سه تا'],
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5l5 5M10 5l-5 5"/><circle cx="16.5" cy="15" r="3.6"/><path d="M7 16l2.5 2.5M9.5 16L7 18.5"/></svg>',
  mount(root, ctx) {
    let board = createBoard();
    let turn = 'x';
    let mode = 'ai';
    let level = 'hard';
    let scores = { x: 0, o: 0, draw: 0 };
    let winLine = null;
    let over = false;
    let busy = false;
    let timer = null;

    const statusEl = h('div', { class: 'game-status', role: 'status' });
    const grid = h('div', { class: 'ttt-board', role: 'grid', 'aria-label': 'صفحه‌ی دوز' });
    const cells = [];

    for (let i = 0; i < 9; i++) {
      const cell = h('button', {
        type: 'button',
        class: 'ttt-cell',
        role: 'gridcell',
        'aria-label': `خانه‌ی ${faNum(i + 1)}`,
        onClick: () => onCell(i),
      });
      cells.push(cell);
      grid.append(cell);
    }

    const scoreRow = h('div', { class: 'scores' });
    function renderScores() {
      scoreRow.replaceChildren(
        h('div', { class: `score ${!over && turn === 'x' ? 'is-turn' : ''}` }, h('span', { class: 'score-label', text: mode === 'ai' ? '× تو' : '× بازیکن ۱' }), h('span', { class: 'score-value', text: faNum(scores.x) })),
        h('div', { class: 'score' }, h('span', { class: 'score-label', text: 'تساوی' }), h('span', { class: 'score-value', text: faNum(scores.draw) })),
        h('div', { class: `score ${!over && turn === 'o' ? 'is-turn' : ''}` }, h('span', { class: 'score-label', text: mode === 'ai' ? '○ کامپیوتر' : '○ نفر دوم' }), h('span', { class: 'score-value', text: faNum(scores.o) })),
      );
    }

    const modeControl = segmented(
      [
        { value: 'ai', label: 'با کامپیوتر' },
        { value: 'local', label: 'دو نفره' },
      ],
      {
        value: mode,
        label: 'حریف',
        onChange: (v) => {
          mode = v;
          levelControl.classList.toggle('hidden', mode !== 'ai');
          newRound();
        },
      },
    );

    const levelControl = segmented(
      [
        { value: 'easy', label: 'آسان' },
        { value: 'hard', label: 'سخت' },
      ],
      {
        value: level,
        label: 'سطح',
        onChange: (v) => {
          level = v;
        },
      },
    );

    function newRound() {
      if (timer) clearTimeout(timer);
      timer = null;
      busy = false;
      over = false;
      winLine = null;
      board = createBoard();
      turn = 'x';
      paint();
    }

    function paint() {
      cells.forEach((cell, i) => {
        const mark = board[i];
        cell.textContent = mark ? MARKS[mark] : '';
        cell.classList.toggle('is-x', mark === 'x');
        cell.classList.toggle('is-o', mark === 'o');
        cell.classList.toggle('is-win', Boolean(winLine && winLine.includes(i)));
        cell.disabled = Boolean(mark) || over || busy;
        cell.setAttribute('aria-label', `خانه‌ی ${faNum(i + 1)}${mark ? `، ${mark === 'x' ? '×' : '○'}` : ''}`);
      });
      renderScores();
      updateStatus();
    }

    function updateStatus() {
      if (over) {
        const win = winner(board);
        if (!win) statusEl.textContent = 'مساوی شد.';
        else if (mode === 'ai') statusEl.textContent = win.mark === 'x' ? 'بردی!' : 'کامپیوتر برد.';
        else statusEl.textContent = `بازیکن ${win.mark === 'x' ? '×' : '○'} برد.`;
        return;
      }
      if (mode === 'ai') {
        statusEl.innerHTML =
          turn === 'x' ? 'نوبت تو — با <strong>×</strong> بازی می‌کنی.' : 'کامپیوتر دارد فکر می‌کند…';
      } else {
        statusEl.innerHTML = `نوبت بازیکن <strong>${turn === 'x' ? '×' : '○'}</strong>.`;
      }
    }

    function finish() {
      over = true;
      busy = false;
      const win = winner(board);
      winLine = win ? win.line : null;
      if (!win) {
        scores.draw += 1;
        if (mode === 'ai') ctx.record('draw');
        play('wrong');
      } else if (mode === 'ai') {
        if (win.mark === 'x') {
          scores.x += 1;
          ctx.record('win');
          play('win');
        } else {
          scores.o += 1;
          ctx.record('loss');
          play('lose');
        }
      } else {
        if (win.mark === 'x') scores.x += 1;
        else scores.o += 1;
        play('win');
      }
      paint();
      const text = !win
        ? 'خانه‌ها پر شدند و نتیجه مساوی شد.'
        : `بازیکن ${win.mark === 'x' ? '×' : '○'} سه‌تا در یک ردیف ساخت.`;
      openModal({
        title: !win ? 'مساوی' : 'برد',
        body: h('p', { text }),
        actions: [
          { label: 'دور بعد', variant: 'primary', onClick: newRound },
          { label: 'بستن', variant: 'ghost' },
        ],
      });
    }

    function place(i, mark) {
      board[i] = mark;
      play('place');
      if (winner(board) || isFull(board)) {
        finish();
        return;
      }
      turn = other(mark);
      paint();
      if (mode === 'ai' && turn === 'o') scheduleAi();
    }

    function onCell(i) {
      if (over || busy || board[i]) return;
      if (mode === 'ai' && turn !== 'x') return;
      place(i, turn);
    }

    function scheduleAi() {
      busy = true;
      paint();
      timer = setTimeout(() => {
        timer = null;
        if (over) return;
        const moves = bestMoves(board.slice(), 'o');
        let move;
        if (level === 'easy' && Math.random() < 0.4) {
          const free = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
          move = free[Math.floor(Math.random() * free.length)];
        } else {
          move = moves[Math.floor(Math.random() * moves.length)];
        }
        busy = false;
        place(move, 'o');
      }, 420);
    }

    const toolbar = h(
      'div',
      { class: 'game-bar' },
      h('div', { class: 'bar-group' }, modeControl, levelControl),
      h('div', { class: 'bar-group' }, btn('دور جدید', { variant: 'soft', onClick: newRound })),
    );

    root.append(
      h(
        'div',
        { class: 'game' },
        toolbar,
        statusEl,
        h('div', { class: 'game-body' }, h('div', { class: 'board-wrap' }, grid), scoreRow),
      ),
    );

    paint();

    return () => {
      if (timer) clearTimeout(timer);
    };
  },
};
