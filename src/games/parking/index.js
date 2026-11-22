import { h, btn, segmented, openModal } from '../../core/ui.js';
import { faNum } from '../../core/i18n.js';
import { play } from '../../core/sound.js';
import { PARKING_LEVELS } from '../../data/parking-levels.js';
import { SIZE, fromLayout, carById, canSlide, slide, isSolved } from './engine.js';

export default {
  id: 'parking',
  title: 'خروج از پارکینگ',
  subtitle: 'ماشین قرمز را از چاله‌ی خروج بیرون بکش',
  meta: 'یک یا دو نفره · ۳ سطح',
  keywords: ['پارکینگ', 'ماشین', 'معما', 'حرکت'],
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><rect x="6" y="9" width="6.5" height="3.6" rx="1.2"/><path d="M16.5 7v10M14.4 9.2l2.1-2.2 2.1 2.2"/></svg>',
  mount(root, ctx) {
    let level = 'easy';
    let puzzle = null;
    let state = null;
    let moves = 0;
    let selected = null;
    let history = [];
    let players = 1;
    let turn = 0;
    let moveCounts = [0, 0];
    let lastMover = 0;
    let finished = false;
    const lastIndex = {};

    const statusEl = h('div', { class: 'game-status', role: 'status' });
    const boardEl = h('div', { class: 'park-board', role: 'grid', 'aria-label': 'پارکینگ' });
    const arrowsSlot = h('div');

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
          newPuzzle();
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
          newPuzzle();
        },
      },
    );

    function newPuzzle() {
      const source = PARKING_LEVELS[level] && PARKING_LEVELS[level].length ? PARKING_LEVELS[level] : PARKING_LEVELS.easy;
      const pool = source;
      let index = Math.floor(Math.random() * pool.length);
      if (pool.length > 1 && index === lastIndex[level]) index = (index + 1) % pool.length;
      lastIndex[level] = index;
      puzzle = pool[index];
      state = fromLayout(puzzle.layout);
      moves = 0;
      selected = null;
      history = [];
      turn = 0;
      moveCounts = [0, 0];
      lastMover = 0;
      finished = false;
      render();
    }

    function render() {
      const cells = [];
      for (let i = 0; i < SIZE * SIZE; i++) {
        cells.push(
          h('button', {
            type: 'button',
            class: 'park-cell',
            style: { gridRow: `${Math.floor(i / SIZE) + 1}`, gridColumn: `${(i % SIZE) + 1}` },
            'aria-label': `خانه ${faNum(i + 1)}`,
            onClick: () => onCell(i),
          }),
        );
      }
      const cars = state.cars.map((car) => {
        const style = {
          gridRow: `${car.r + 1} / span ${car.dir === 'v' ? car.len : 1}`,
          gridColumn: `${car.c + 1} / span ${car.dir === 'h' ? car.len : 1}`,
        };
        return h(
          'button',
          {
            type: 'button',
            class: `park-car ${car.id === 'X' ? 'is-red' : ''} ${selected === car.id ? 'is-selected' : ''}`.trim(),
            style,
            'aria-label': `ماشین ${car.id === 'X' ? 'قرمز' : faNum(car.id.charCodeAt(0) - 64)}`,
            onClick: () => select(car.id),
          },
          h('span', { class: 'park-car-label', text: '' }),
        );
      });
      boardEl.style.setProperty('--size', String(SIZE));
      boardEl.replaceChildren(...cells, ...cars);
      const remaining = Math.max(0, puzzle.min - moves);
      const who = players === 2 ? `نوبت بازیکن ${faNum(turn + 1)} — ` : '';
      statusEl.innerHTML = selected
        ? `${who}روی خانه‌ی خالی در همان ردیف یا ستون بزن تا ماشین بلغزد.`
        : `${who}ماشین قرمز را به چاله‌ی خروج برسان — ${faNum(moves)} حرکت.`;
      if (remaining > 0 && !selected) {
        statusEl.innerHTML += ` <span class="faint small">(حداقل ${faNum(puzzle.min)})</span>`;
      }
      arrowsSlot.replaceChildren(arrowPad());
    }

    function select(id) {
      if (isSolved(state)) return;
      selected = selected === id ? null : id;
      play('click');
      render();
    }

    function onCell(index) {
      if (!selected) return;
      const car = carById(state, selected);
      if (!car) return;
      const r = Math.floor(index / SIZE);
      const c = index % SIZE;
      if (car.dir === 'h' && r !== car.r) return;
      if (car.dir === 'v' && c !== car.c) return;

      let delta = null;
      for (let d = -5; d <= 5; d++) {
        if (!d) continue;
        const nr = car.dir === 'v' ? car.r + d : car.r;
        const nc = car.dir === 'h' ? car.c + d : car.c;
        if (r >= nr && r < nr + car.len && c >= nc && c < nc + car.len && canSlide(state, car, d)) {
          delta = d;
          break;
        }
      }
      if (delta === null) return;
      history.push({ state, turn, moves, moveCounts: [...moveCounts], lastMover });
      state = slide(state, car.id, delta);
      moves += 1;
      moveCounts[turn] += 1;
      lastMover = turn;
      selected = null;
      play('slide');
      if (isSolved(state)) {
        render();
        finish();
        return;
      }
      if (players === 2) turn = 1 - turn;
      render();
    }

    function nudge(delta) {
      if (!selected) return;
      const car = carById(state, selected);
      if (!car) return;
      if (!canSlide(state, car, delta)) return;
      history.push({ state, turn, moves, moveCounts: [...moveCounts], lastMover });
      state = slide(state, car.id, delta);
      moves += 1;
      play('move');
      render();
      if (isSolved(state)) finish();
    }

    function undo() {
      if (!history.length || finished) return;
      const snap = history.pop();
      state = snap.state;
      turn = snap.turn;
      moves = snap.moves;
      moveCounts = snap.moveCounts;
      lastMover = snap.lastMover;
      selected = null;
      render();
    }

    function finish() {
      if (finished) return;
      finished = true;
      selected = null;
      if (players === 1) {
        ctx.record('win');
        ctx.record(moves);
      }
      play('win');
      render();
      openModal({
        title: players === 2 ? `بازیکن ${faNum(lastMover + 1)} برد` : 'از پارکینگ بیرون زد',
        body: h('p', {
          text: players === 2
            ? `در ${faNum(moves)} حرکت — بازیکن ۱: ${faNum(moveCounts[0])}، بازیکن ۲: ${faNum(moveCounts[1])}`
            : `با ${faNum(moves)} حرکت — کمترین راه ${faNum(puzzle.min)} حرکت بود.`,
        }),
        actions: [
          { label: 'پارکینگ بعدی', variant: 'primary', onClick: newPuzzle },
          { label: 'بستن', variant: 'ghost' },
        ],
      });
    }

    function arrowPad() {
      if (!selected) return h('div');
      const car = carById(state, selected);
      if (!car) return h('div');
      const buttons =
        car.dir === 'h'
          ? [
              ['◀', -1],
              ['▶', 1],
            ]
          : [
              ['▲', -1],
              ['▼', 1],
            ];
      return h('div', { class: 'park-arrows' }, ...buttons.map(([label, delta]) => btn(label, { variant: 'soft', onClick: () => nudge(delta) })));
    }

    root.append(
      h(
        'div',
        { class: 'game' },
        h(
          'div',
          { class: 'game-bar' },
          h('div', { class: 'bar-group' }, playersControl, levelControl),
          h(
            'div',
            { class: 'bar-group' },
            btn('حرکت قبل', { variant: 'soft', onClick: undo }),
            btn('پارکینگ جدید', { variant: 'ghost', onClick: newPuzzle }),
          ),
        ),
        statusEl,
        h(
          'div',
          { class: 'game-body' },
          h('div', { class: 'park-stage' }, h('div', { class: 'park-board-wrap' }, boardEl, h('span', { class: 'park-exit', text: 'خروج' }))),
          arrowsSlot,
        ),
        h('p', { class: 'small faint center', text: 'اول ماشین را انتخاب کن، بعد خانه‌ی مقصد را بزن.' }),
      ),
    );

    newPuzzle();
  },
};
