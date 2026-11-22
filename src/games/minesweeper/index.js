import { h, btn, segmented, openModal } from '../../core/ui.js';
import { faNum } from '../../core/i18n.js';
import { play } from '../../core/sound.js';
import { PRESETS, createGame, placeMines, reveal, toggleFlag, flagsUsed } from './engine.js';

const NUMBERS = ['', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸'];

export default {
  id: 'minesweeper',
  title: 'مین‌روب',
  subtitle: 'خانه‌ها را باز کن، به مین نزن',
  meta: 'یک یا دو نفره · ۳ سطح',
  keywords: ['مین', 'مین‌روب', 'خانه', 'پرچم'],
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="11" cy="13" r="6.2"/><path d="M11 3.5v2.5M15.5 6l-1.6 1.6M17.8 12.6h-2.4M11 19.5V22M6.5 20l1.4-1.4"/><circle cx="18.6" cy="5.4" r="1" fill="currentColor"/></svg>',
  mount(root, ctx) {
    let level = 'easy';
    let state = createGame(PRESETS[level].rows, PRESETS[level].cols, PRESETS[level].mines);
    let flagMode = false;
    let seconds = 0;
    let timer = null;
    let players = 1;
    let turn = 0;
    let revealedCounts = [0, 0];

    const statusEl = h('div', { class: 'game-status', role: 'status' });
    const boardEl = h('div', { class: 'ms-grid', role: 'grid', 'aria-label': 'صفحه‌ی مین‌روب' });
    const infoEl = h('div', { class: 'row small' });

    const playersControl = segmented(
      [
        { value: 1, label: 'یک‌نفره' },
        { value: 2, label: 'دو نفره' },
      ],
      {
        value: players,
        label: 'بازیکن',
        onChange: (v) => {
          players = v;
          reset();
        },
      },
    );

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

    const flagBtn = h('button', {
      type: 'button',
      class: 'chip chip-toggle',
      text: 'پرچم',
      'aria-pressed': 'false',
      onClick: () => {
        flagMode = !flagMode;
        flagBtn.classList.toggle('is-on', flagMode);
        flagBtn.setAttribute('aria-pressed', String(flagMode));
        render();
      },
    });

    function reset() {
      state = createGame(PRESETS[level].rows, PRESETS[level].cols, PRESETS[level].mines);
      seconds = 0;
      flagMode = false;
      turn = 0;
      revealedCounts = [0, 0];
      flagBtn.classList.remove('is-on');
      if (timer) clearInterval(timer);
      timer = null;
      render();
    }

    function startTimer() {
      if (timer) return;
      timer = setInterval(() => {
        seconds += 1;
        renderInfo();
      }, 1000);
    }

    function renderInfo() {
      const left = Math.max(0, state.mines - flagsUsed(state));
      const chips = [
        h('span', { class: 'chip', text: `مین باقی‌مانده: ${faNum(left)}` }),
        h('span', { class: 'chip', text: `زمان: ${faNum(seconds)} ثانیه` }),
        h('span', { class: 'chip', text: flagMode ? 'حالت پرچم روشن' : 'حالت باز کردن' }),
      ];
      if (players === 2) {
        chips.push(
          h('span', { class: `chip ${turn === 0 && !state.over ? 'chip-accent' : ''}`.trim(), text: `بازیکن ۱: ${faNum(revealedCounts[0])}` }),
          h('span', { class: `chip ${turn === 1 && !state.over ? 'chip-accent' : ''}`.trim(), text: `بازیکن ۲: ${faNum(revealedCounts[1])}` }),
        );
      }
      infoEl.replaceChildren(...chips);
    }

    function render() {
      const cells = [];
      for (let i = 0; i < state.cells.length; i++) {
        const cell = state.cells[i];
        const classes = ['ms-cell'];
        if (cell.revealed) classes.push('is-open');
        if (cell.flagged && !cell.revealed) classes.push('is-flag');
        if (cell.revealed && cell.mine) classes.push('is-mine');
        if (i === state.exploded) classes.push('is-exploded');
        if (cell.revealed && !cell.mine && cell.count) classes.push(`n${cell.count}`);

        const label = cell.revealed
          ? cell.mine
            ? 'مین'
            : cell.count
              ? NUMBERS[cell.count]
              : 'خالی'
          : cell.flagged
            ? 'پرچم'
            : 'بسته';
        const cellEl = h(
          'button',
          {
            type: 'button',
            class: classes.join(' '),
            role: 'gridcell',
            'aria-label': `خانه ${faNum(i + 1)}، ${label}`,
            onContextmenu: (e) => {
              e.preventDefault();
              onFlag(i);
            },
          },
          cell.revealed && !cell.mine && cell.count ? h('span', { class: 'ms-num', text: NUMBERS[cell.count] }) : null,
          cell.flagged && !cell.revealed ? h('span', { class: 'ms-flag', 'aria-hidden': 'true' }) : null,
          cell.revealed && cell.mine ? h('span', { class: 'ms-mine', 'aria-hidden': 'true' }) : null,
        );
        let pressTimer = null;
        let longPressed = false;
        cellEl.addEventListener('pointerdown', () => {
          longPressed = false;
          pressTimer = setTimeout(() => {
            pressTimer = null;
            longPressed = true;
            onFlag(i);
          }, 450);
        });
        const cancelPress = () => {
          if (pressTimer) clearTimeout(pressTimer);
          pressTimer = null;
        };
        cellEl.addEventListener('pointerup', cancelPress);
        cellEl.addEventListener('pointerleave', cancelPress);
        cellEl.addEventListener('pointercancel', cancelPress);
        cellEl.addEventListener('click', (e) => {
          if (longPressed) {
            e.preventDefault();
            longPressed = false;
            return;
          }
          onCell(i);
        });
        cells.push(cellEl);
      }
      boardEl.style.setProperty('--cols', String(state.cols));
      boardEl.replaceChildren(...cells);
      renderInfo();
      updateStatus();
    }

    function updateStatus() {
      if (state.over) return;
      const remaining = state.cells.filter((cell) => !cell.revealed).length;
      const who = players === 2 ? `نوبت بازیکن ${faNum(turn + 1)} — ` : '';
      statusEl.textContent = state.started
        ? `${who}${faNum(remaining)} خانه‌ی بسته مانده. ${flagMode ? 'با لمس، پرچم بگذار.' : 'خانه‌ها را باز کن.'}`
        : `${who}اولین خانه را باز کن؛ مین‌ها بعد از آن چیده می‌شوند.`;
    }

    function onCell(i) {
      if (state.over) return;
      if (flagMode) {
        onFlag(i);
        return;
      }
      if (state.cells[i].flagged) return;
      play('reveal');
      if (!state.started) state = placeMines(state, i);
      const before = state.cells.filter((cell) => cell.revealed).length;
      state = reveal(state, i);
      const gained = state.cells.filter((cell) => cell.revealed).length - before;
      revealedCounts[turn] += Math.max(0, gained);
      if (state.started) startTimer();
      if (state.over) {
        finish();
      } else {
        if (players === 2) turn = 1 - turn;
        render();
      }
    }

    function onFlag(i) {
      if (state.over) return;
      if (!state.started) return;
      state = toggleFlag(state, i);
      play('flag');
      render();
    }

    function finish() {
      if (timer) clearInterval(timer);
      timer = null;
      render();
      if (players === 2) {
        const loser = state.won ? -1 : turn;
        const winner = state.won
          ? revealedCounts[0] === revealedCounts[1]
            ? turn
            : revealedCounts[0] > revealedCounts[1]
              ? 0
              : 1
          : 1 - turn;
        play(state.won ? 'win' : 'boom');
        statusEl.textContent = state.won
          ? `همه‌ی خانه‌های سالم باز شد — بازیکن ${faNum(winner + 1)} برد.`
          : `بازیکن ${faNum(loser + 1)} روی مین رفت.`;
        openModal({
          title: `بازیکن ${faNum(winner + 1)} برد`,
          body: h('p', {
            text: state.won
              ? `خانه‌های بازشده: ${faNum(revealedCounts[0])} — ${faNum(revealedCounts[1])}`
              : `بازیکن ${faNum(loser + 1)} روی مین رفت.`,
          }),
          actions: [
            { label: 'بازی جدید', variant: 'primary', onClick: reset },
            { label: 'بستن', variant: 'ghost' },
          ],
        });
        return;
      }
      if (state.won) {
        ctx.record('win');
        ctx.record(seconds);
        play('win');
        statusEl.textContent = 'همه‌ی خانه‌های سالم باز شد.';
        openModal({
          title: 'بردی',
          body: h('p', { text: `در ${faNum(seconds)} ثانیه تمام شد.` }),
          actions: [
            { label: 'بازی جدید', variant: 'primary', onClick: reset },
            { label: 'بستن', variant: 'ghost' },
          ],
        });
      } else {
        ctx.record('loss');
        play('boom');
        statusEl.textContent = 'روی مین رفتی.';
        openModal({
          title: 'بوم!',
          body: h('p', { text: 'روی مین رفتی. دوباره امتحان کن.' }),
          actions: [
            { label: 'بازی جدید', variant: 'primary', onClick: reset },
            { label: 'بستن', variant: 'ghost' },
          ],
        });
      }
    }

    root.append(
      h(
        'div',
        { class: 'game' },
        h('div', { class: 'game-bar' }, h('div', { class: 'bar-group' }, playersControl, levelControl, flagBtn), h('div', { class: 'bar-group' }, btn('بازی جدید', { variant: 'ghost', onClick: reset }))),
        statusEl,
        h('div', { class: 'game-body' }, boardEl, infoEl),
      ),
    );

    render();

    return () => {
      if (timer) clearInterval(timer);
    };
  },
};
