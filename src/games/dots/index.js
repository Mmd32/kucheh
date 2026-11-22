import { h, s, btn, segmented, openModal, toast } from '../../core/ui.js';
import { faNum } from '../../core/i18n.js';
import { play } from '../../core/sound.js';
import { createState, draw, isOver, aiMove } from './engine.js';

const SP = 46;
const PAD = 26;

export default {
  id: 'dots',
  title: 'نقطه‌بازی',
  subtitle: 'خط بکش، خانه بگیر',
  meta: 'دو نفره یا کامپیوتر',
  keywords: ['نقطه', 'خانه', 'خط'],
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 6h13M6 6v13M19 6v13M6 19h13"/><circle cx="6" cy="6" r="1.2" fill="currentColor"/><circle cx="19" cy="6" r="1.2" fill="currentColor"/><circle cx="6" cy="19" r="1.2" fill="currentColor"/><circle cx="19" cy="19" r="1.2" fill="currentColor"/></svg>',
  mount(root, ctx) {
    let state = createState(5, 5);
    let mode = 'ai';
    let level = 'normal';
    let busy = false;
    let timer = null;
    const saved = ctx.load();

    if (saved && Array.isArray(saved.h) && saved.h.length === 6) {
      state = saved;
      toast('بازی قبلی ادامه پیدا کرد');
    }

    const statusEl = h('div', { class: 'game-status', role: 'status' });
    const boardWrap = h('div', { class: 'dots-wrap' });
    const scoreRow = h('div', { class: 'scores' });

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
          reset();
        },
      },
    );

    const levelControl = segmented(
      [
        { value: 'easy', label: 'آسان' },
        { value: 'normal', label: 'معمولی' },
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

    function reset() {
      if (timer) clearTimeout(timer);
      timer = null;
      busy = false;
      finished = false;
      state = createState(5, 5);
      ctx.clearSave();
      render();
    }

    function name(i) {
      if (mode === 'ai') return i === 0 ? 'تو' : 'کامپیوتر';
      return i === 0 ? 'بازیکن ۱' : 'بازیکن ۲';
    }

    function paintScores() {
      scoreRow.replaceChildren(
        ...[0, 1].map((i) =>
          h(
            'div',
            { class: `score ${state.turn === i && !isOver(state) ? 'is-turn' : ''}` },
            h('span', { class: 'score-label' }, h('span', { class: `dot dot-${i + 1}` }), name(i)),
            h('span', { class: 'score-value', text: faNum(state.scores[i]) }),
          ),
        ),
      );
    }

    function updateStatus() {
      if (isOver(state)) {
        const [a, b] = state.scores;
        statusEl.textContent = a === b ? `مساوی شد (${faNum(a)} — ${faNum(b)}).` : `${name(a > b ? 0 : 1)} برد ${faNum(Math.max(a, b))} — ${faNum(Math.min(a, b))}.`;
        return;
      }
      if (mode === 'ai') {
        statusEl.innerHTML = state.turn === 0 ? 'خط بکش؛ اگر خانه ببندی، دوباره نوبت توست.' : 'کامپیوتر دارد بازی می‌کند…';
      } else {
        statusEl.innerHTML = `نوبت <strong>${name(state.turn)}</strong>.`;
      }
    }

    function makeBoard() {
      const { rows, cols } = state;
      const W = cols * SP + PAD * 2;
      const H = rows * SP + PAD * 2;
      const svg = s('svg', {
        class: 'dots-board',
        viewBox: `0 0 ${W} ${H}`,
        role: 'group',
        'aria-label': 'صفحه‌ی نقطه‌بازی',
      });

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const owner = state.boxes[r * cols + c];
          if (!owner) continue;
          svg.append(
            s('rect', {
              x: PAD + c * SP + 3,
              y: PAD + r * SP + 3,
              width: SP - 6,
              height: SP - 6,
              rx: 6,
              class: owner === 1 ? 'dot-box dot-box-1' : 'dot-box dot-box-2',
            }),
          );
        }
      }

      const line = (x1, y1, x2, y2, cls, hit) => {
        const el = s('line', {
          x1,
          y1,
          x2,
          y2,
          class: hit ? 'edge-hit' : cls,
          'stroke-linecap': 'round',
        });
        return el;
      };

      // خطوط افقی
      for (let r = 0; r <= rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x1 = PAD + c * SP;
          const x2 = x1 + SP;
          const y = PAD + r * SP;
          const owner = state.h[r][c];
          if (owner) svg.append(line(x1, y, x2, y, owner === 1 ? 'dot-line dot-line-1' : 'dot-line dot-line-2', false));
          else {
            const hit = line(x1, y, x2, y, '', true);
            hit.addEventListener('click', () => onEdge({ type: 'h', r, c }));
            hit.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') onEdge({ type: 'h', r, c });
            });
            hit.setAttribute('tabindex', '0');
            hit.setAttribute('role', 'button');
            hit.setAttribute('aria-label', `خط افقی ردیف ${faNum(r + 1)} ستون ${faNum(c + 1)}`);
            svg.append(hit);
          }
        }
      }

      // خطوط عمودی
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c <= cols; c++) {
          const x = PAD + c * SP;
          const y1 = PAD + r * SP;
          const y2 = y1 + SP;
          const owner = state.v[r][c];
          if (owner) svg.append(line(x, y1, x, y2, owner === 1 ? 'dot-line dot-line-1' : 'dot-line dot-line-2', false));
          else {
            const hit = line(x, y1, x, y2, '', true);
            hit.addEventListener('click', () => onEdge({ type: 'v', r, c }));
            hit.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') onEdge({ type: 'v', r, c });
            });
            hit.setAttribute('tabindex', '0');
            hit.setAttribute('role', 'button');
            hit.setAttribute('aria-label', `خط عمودی ردیف ${faNum(r + 1)} ستون ${faNum(c + 1)}`);
            svg.append(hit);
          }
        }
      }

      // نقطه‌ها
      for (let r = 0; r <= rows; r++) {
        for (let c = 0; c <= cols; c++) {
          svg.append(s('circle', { cx: PAD + c * SP, cy: PAD + r * SP, r: 3.4, class: 'dot-point' }));
        }
      }

      return svg;
    }

    function render() {
      boardWrap.replaceChildren(makeBoard());
      paintScores();
      updateStatus();
      if (isOver(state)) onFinish();
    }

    function onEdge(edge) {
      if (busy || isOver(state)) return;
      if (mode === 'ai' && state.turn !== 0) return;
      const res = draw(state, edge, state.turn);
      if (!res) return;
      if (res.gained) play('correct');
      else play('move');
      state = res.state;
      ctx.save(state);
      render();
      if (!isOver(state) && mode === 'ai' && state.turn === 1) scheduleAi();
    }

    function scheduleAi() {
      busy = true;
      updateStatus();
      timer = setTimeout(() => {
        timer = null;
        if (isOver(state)) return;
        const move = aiMove(state, level);
        busy = false;
        if (!move) return;
        const res = draw(state, move, state.turn);
        if (!res) return;
        if (res.gained) play('correct');
        else play('move');
        state = res.state;
        ctx.save(state);
        render();
        if (!isOver(state) && state.turn === 1) scheduleAi();
      }, 480);
    }

    let finished = false;
    function onFinish() {
      if (finished) return;
      finished = true;
      ctx.clearSave();
      const [a, b] = state.scores;
      if (a === b) {
        ctx.record('draw');
        play('wrong');
      } else if (mode === 'ai') {
        if (a > b) {
          ctx.record('win');
          play('win');
        } else {
          ctx.record('loss');
          play('lose');
        }
      } else {
        play('win');
      }
      openModal({
        title: a === b ? 'مساوی' : `${name(a > b ? 0 : 1)} برد`,
        body: h('p', { text: `نتیجه: ${faNum(a)} — ${faNum(b)}` }),
        actions: [
          { label: 'دور جدید', variant: 'primary', onClick: reset },
          { label: 'بستن', variant: 'ghost' },
        ],
      });
    }

    root.append(
      h(
        'div',
        { class: 'game' },
        h('div', { class: 'game-bar' }, h('div', { class: 'bar-group' }, modeControl, levelControl), h('div', { class: 'bar-group' }, btn('دور جدید', { variant: 'soft', onClick: reset }))),
        statusEl,
        h('div', { class: 'game-body' }, boardWrap, scoreRow),
      ),
    );

    finished = false;
    render();

    return () => {
      if (timer) clearTimeout(timer);
    };
  },
};
