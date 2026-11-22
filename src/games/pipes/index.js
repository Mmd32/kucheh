import { h, s, btn, segmented, openModal, toast } from '../../core/ui.js';
import { faNum } from '../../core/i18n.js';
import { play } from '../../core/sound.js';
import { SIZES, DIRS, createPuzzle, rotateCell, waterCells, isSolved, maskOf, openDirections } from './engine.js';

const TAP_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5h9v4h-4v7a3 3 0 01-3 3H5"/><path d="M14 7h5v4h-5"/><path d="M17 11v3"/></svg>';

function cellSvg(state, index, watered) {
  const mask = maskOf(state, index);
  const svg = s('svg', { viewBox: '0 0 100 100', class: `pipe-svg ${watered ? 'is-water' : ''}`.trim(), 'aria-hidden': 'true' });
  for (const dir of DIRS) {
    if (!(mask & dir.bit)) continue;
    const x2 = 50 + dir.dc * 50;
    const y2 = 50 + dir.dr * 50;
    svg.append(s('line', { x1: 50, y1: 50, x2, y2, class: 'pipe-line' }));
  }
  svg.append(s('circle', { cx: 50, cy: 50, r: 14, class: 'pipe-hub' }));
  for (const dir of openDirections(state, index)) {
    if (index === state.source && dir.dr === -1) continue;
    svg.append(s('circle', { cx: 50 + dir.dc * 46, cy: 50 + dir.dr * 46, r: 7, class: 'pipe-cap' }));
  }
  return svg;
}

export default {
  id: 'pipes',
  title: 'لوله‌کشی آب',
  subtitle: 'لوله‌ها را بچرخان تا آب همه‌جا برسد',
  meta: 'یک یا دو نفره · ۳ اندازه',
  keywords: ['لوله', 'آب', 'چرخش', 'معما'],
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h7v7h7v5"/><circle cx="4" cy="6" r="1.6"/><circle cx="18" cy="18" r="1.6"/><path d="M4 6v12h3"/></svg>',
  mount(root, ctx) {
    let level = 'medium';
    let state = createPuzzle(SIZES[level]);
    let moves = 0;
    let finished = false;
    let players = 1;
    let turn = 0;
    let rotates = [0, 0];
    let lastMover = 0;
    let hintsUsed = 0;

    const statusEl = h('div', { class: 'game-status', role: 'status' });
    const boardEl = h('div', { class: 'pipe-grid', role: 'grid', 'aria-label': 'صفحه‌ی لوله‌کشی' });
    const hintBtn = btn('راهنما (۳)', { variant: 'soft', onClick: useHint });

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
      state = createPuzzle(SIZES[level]);
      moves = 0;
      finished = false;
      turn = 0;
      rotates = [0, 0];
      lastMover = 0;
      hintsUsed = 0;
      render();
    }

    function useHint() {
      if (finished || players === 2 || hintsUsed >= 3) return;
      const wrong = [];
      for (let i = 0; i < state.size * state.size; i++) {
        if (i === state.source) continue;
        if (state.rot[i] !== state.solution[i]) wrong.push(i);
      }
      if (!wrong.length) return;
      const pick = wrong[Math.floor(Math.random() * wrong.length)];
      const rot = state.rot.slice();
      rot[pick] = state.solution[pick];
      state = { ...state, rot };
      hintsUsed += 1;
      lastMover = turn;
      play('valve');
      render();
    }

    function render() {
      const watered = waterCells(state);
      const cells = [];
      for (let i = 0; i < state.size * state.size; i++) {
        const cell = h(
          'button',
          {
            type: 'button',
            class: `pipe-cell ${watered.has(i) ? 'is-water' : ''} ${i === state.source ? 'is-source' : ''}`.trim(),
            role: 'gridcell',
            'aria-label': `لوله ${faNum(i + 1)}${watered.has(i) ? '، آب دارد' : ''}${i === state.source ? '، شیر آب' : ''}`,
            onClick: () => onClick(i),
          },
          cellSvg(state, i, watered.has(i)),
          i === state.source ? h('span', { class: 'pipe-tap', html: TAP_ICON, title: 'شیر آب' }) : null,
        );
        cells.push(cell);
      }
      boardEl.style.setProperty('--cols', String(state.size));
      boardEl.replaceChildren(...cells);

      hintBtn.classList.toggle('hidden', players === 2);
      hintBtn.textContent = `راهنما (${faNum(Math.max(0, 3 - hintsUsed))})`;
      hintBtn.disabled = finished || hintsUsed >= 3;

      const done = watered.size;
      const total = state.size * state.size;
      const who = players === 2 ? `نوبت بازیکن ${faNum(turn + 1)} — ` : '';
      statusEl.innerHTML = finished
        ? players === 2
          ? `بازیکن ${faNum(lastMover + 1)} آب را رساند.`
          : 'همه‌ی لوله‌ها پر از آب شد.'
        : `${who}آب در <strong>${faNum(done)}</strong> از ${faNum(total)} خانه رسیده — ${faNum(moves)} چرخش.`;

      if (!finished && done === total) {
        finished = true;
        if (players === 1) ctx.record('win');
        play('water');
        setTimeout(() => play('win'), 260);
        render();
        openModal({
          title: players === 2 ? `بازیکن ${faNum(lastMover + 1)} برد` : 'آب رسید',
          body: h('p', {
            text:
              players === 2
                ? `با ${faNum(moves)} چرخش — بازیکن ۱: ${faNum(rotates[0])}، بازیکن ۲: ${faNum(rotates[1])}`
                : `با ${faNum(moves)} چرخش همه‌ی لوله‌ها پر شد.`,
          }),
          actions: [
            { label: 'جدول بعدی', variant: 'primary', onClick: newPuzzle },
            { label: 'بستن', variant: 'ghost' },
          ],
        });
      }
    }

    function onClick(i) {
      if (finished) return;
      if (i === state.source) {
        toast('شیر آب ثابت است؛ لوله‌های دیگر را بچرخان');
        return;
      }
      state = rotateCell(state, i);
      moves += 1;
      lastMover = turn;
      rotates[turn] += 1;
      play('valve');
      if (players === 2) turn = 1 - turn;
      render();
    }

    const steps = h(
      'div',
      { class: 'pipe-steps' },
      h('div', { class: 'pipe-step' }, h('b', { text: '۱' }), h('span', { text: 'شیر آب بالای جدول است؛ آب از همان خانه وارد می‌شود.' })),
      h('div', { class: 'pipe-step' }, h('b', { text: '۲' }), h('span', { text: 'روی هر لوله بزن تا ۹۰ درجه بچرخد و به همسایه‌اش وصل شود.' })),
      h('div', { class: 'pipe-step' }, h('b', { text: '۳' }), h('span', { text: 'همه‌ی خانه‌ها باید پرآب شوند. سرهای باز، نقطه‌ی طلایی دارند.' })),
    );

    const legend = h(
      'div',
      { class: 'pipe-legend' },
      h('span', { class: 'chip' }, h('span', { class: 'legend-dot legend-water' }), 'پرآب'),
      h('span', { class: 'chip' }, h('span', { class: 'legend-dot legend-dry' }), 'خشک'),
      h('span', { class: 'chip' }, h('span', { class: 'legend-dot legend-cap' }), 'سر باز'),
    );

    root.append(
      h(
        'div',
        { class: 'game' },
        h(
          'div',
          { class: 'game-bar' },
          h('div', { class: 'bar-group' }, playersControl, levelControl),
          h('div', { class: 'bar-group' }, hintBtn, btn('جدول جدید', { variant: 'ghost', onClick: newPuzzle })),
        ),
        statusEl,
        h('div', { class: 'game-body' }, steps, boardEl, legend),
      ),
    );

    render();
  },
};
