import { h, btn, segmented, openModal, toast } from '../../core/ui.js';
import { faNum } from '../../core/i18n.js';
import { play } from '../../core/sound.js';
import { SPEEDS, DIRECTIONS, createState, turn, step } from './engine.js';

const LEVELS = {
  easy: { walls: 0, speed: SPEEDS.easy },
  medium: { walls: 5, speed: SPEEDS.medium },
  hard: { walls: 10, speed: SPEEDS.hard },
};

export default {
  id: 'snake',
  title: 'مار بازی',
  subtitle: 'غذا بخور، بلندتر شو، به خودت نزن',
  meta: 'یک‌نفره · ۳ سرعت',
  keywords: ['مار', 'snake', 'غذا', 'کلاسیک'],
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 18h6a3 3 0 000-6H7a3 3 0 010-6h7"/><circle cx="17.5" cy="6" r="2.2"/><path d="M17.5 8.2V12"/></svg>',
  mount(root, ctx) {
    let level = 'medium';
    let state = createState({ walls: LEVELS[level].walls });
    let loop = null;
    let paused = false;
    let started = false;
    const readBest = () => (typeof ctx.stat === 'function' && ctx.stat() ? ctx.stat().best : 0) || 0;
    let best = readBest();

    const statusEl = h('div', { class: 'game-status', role: 'status' });
    const boardEl = h('div', { class: 'snake-grid', role: 'grid', 'aria-label': 'صفحه‌ی مار' });
    const cellEls = [];

    const pauseBtn = btn('توقف', {
      variant: 'soft',
      onClick: () => {
        paused = !paused;
        pauseBtn.textContent = paused ? 'ادامه' : 'توقف';
        paint();
      },
    });

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
          reset();
        },
      },
    );

    for (let i = 0; i < state.cols * state.rows; i++) {
      const cell = h('div', { class: 'snake-cell', 'aria-hidden': 'true' });
      cellEls.push(cell);
      boardEl.append(cell);
    }
    boardEl.style.setProperty('--cols', String(state.cols));

    function reset() {
      state = createState({ walls: LEVELS[level].walls });
      paused = false;
      started = false;
      pauseBtn.textContent = 'توقف';
      if (loop) clearInterval(loop);
      loop = null;
      paint();
    }

    function begin() {
      if (started || state.dead) return;
      started = true;
      if (loop) clearInterval(loop);
      loop = setInterval(tick, LEVELS[level].speed);
      paint();
    }

    function paint() {
      const snakeSet = new Map();
      state.snake.forEach((cell, index) => snakeSet.set(cell, index));
      cellEls.forEach((el, index) => {
        const part = snakeSet.has(index);
        const isHead = index === state.snake[0];
        el.className = [
          'snake-cell',
          part ? 'is-body' : '',
          isHead ? 'is-head' : '',
          index === state.food ? 'is-food' : '',
          state.walls.includes(index) ? 'is-wall' : '',
        ]
          .filter(Boolean)
          .join(' ');
      });
      statusEl.innerHTML = started
        ? `امتیاز: <strong>${faNum(state.score)}</strong>${paused ? ' — بازی متوقف است.' : ''}${best ? ` · رکورد: ${faNum(best)}` : ''}`
        : `${best ? `رکورد تو: ${faNum(best)} — ` : ''}برای شروع، یک جهت را بزن (کلیدهای جهت یا دی‌پد).`;
    }

    function tick() {
      if (paused || state.dead) return;
      const before = state.score;
      state = step(state);
      paint();
      if (state.score > before) play('eat');
      if (state.dead) end();
    }

    function end() {
      if (loop) clearInterval(loop);
      loop = null;
      play('lose');
      ctx.record('loss');
      const wasRecord = state.score > best;
      ctx.record(state.score);
      best = Math.max(best, readBest());
      if (wasRecord) toast('رکورد جدید!');
      openModal({
        title: 'بازی تمام شد',
        body: h('p', { text: `امتیازت: ${faNum(state.score)}` }),
        actions: [
          { label: 'دوباره', variant: 'primary', onClick: reset },
          { label: 'بستن', variant: 'ghost' },
        ],
      });
    }

    function change(dir) {
      if (state.dead) return;
      begin();
      state = turn(state, dir);
    }

    function onKey(e) {
      const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
      const dir = map[e.key];
      if (!dir) return;
      if (e.key.startsWith('Arrow')) e.preventDefault();
      change(dir);
    }
    document.addEventListener('keydown', onKey);

    function onVisibility() {
      if (document.hidden && started && !paused) {
        paused = true;
        pauseBtn.textContent = 'ادامه';
        paint();
      }
    }
    document.addEventListener('visibilitychange', onVisibility);

    const pad = h(
      'div',
      { class: 'snake-dpad' },
      h('button', { type: 'button', class: 'snake-dir', 'aria-label': 'بالا', text: '▲', onClick: () => change('up') }),
      h('button', { type: 'button', class: 'snake-dir', 'aria-label': 'چپ', text: '◀', onClick: () => change('left') }),
      h('button', { type: 'button', class: 'snake-dir', 'aria-label': 'پایین', text: '▼', onClick: () => change('down') }),
      h('button', { type: 'button', class: 'snake-dir', 'aria-label': 'راست', text: '▶', onClick: () => change('right') }),
    );

    let touchStart = null;
    boardEl.addEventListener('pointerdown', (e) => {
      touchStart = { x: e.clientX, y: e.clientY };
    });
    boardEl.addEventListener('pointerup', (e) => {
      if (!touchStart) return;
      const dx = e.clientX - touchStart.x;
      const dy = e.clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
      if (Math.abs(dx) > Math.abs(dy)) change(dx > 0 ? 'right' : 'left');
      else change(dy > 0 ? 'down' : 'up');
    });

    root.append(
      h(
        'div',
        { class: 'game' },
        h(
          'div',
          { class: 'game-bar' },
          h('div', { class: 'bar-group' }, levelControl),
          h(
            'div',
            { class: 'bar-group' },
            pauseBtn,
            btn('بازی جدید', { variant: 'ghost', onClick: reset }),
          ),
        ),
        statusEl,
        h('div', { class: 'game-body snake-layout' }, boardEl, pad),
      ),
    );

    reset();

    return () => {
      if (loop) clearInterval(loop);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  },
};
