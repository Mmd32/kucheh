import { h, s, btn, segmented, openModal, toast } from '../../core/ui.js';
import { faNum } from '../../core/i18n.js';
import { play } from '../../core/sound.js';
import { die } from '../../core/dice.js';
import { SIZE, VARIANTS, displayPos, numberAt, applyRoll } from './engine.js';

const COLORS = ['p1', 'p2', 'p3', 'p4'];

export default {
  id: 'snakes',
  title: 'مار و پله',
  subtitle: 'با تاس بالا و پایین برو',
  meta: '۲ تا ۴ نفره',
  keywords: ['مار', 'پله', 'تاس'],
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v13M9 4v13M4 7h5M4 10h5M4 13h5"/><path d="M17 3c-3 2 3 4 0 6s3 4 0 6 3 4 0 6"/></svg>',
  mount(root, ctx) {
    let count = 2;
    let mode = 'ai';
    let level = 'medium';
    let variant = VARIANTS[level];
    let positions = [0, 0];
    let turn = 0;
    let lastRoll = 0;
    let busy = false;
    let finished = false;
    let timer = null;

    const statusEl = h('div', { class: 'game-status', role: 'status' });
    const boardEl = h('div', { class: 'snakes-wrap' });
    const diceSlot = h('div', { class: 'dice-slot' });
    const rollBtn = btn('تاس بریز', { variant: 'primary', onClick: roll });

    const countControl = segmented(
      [
        { value: 2, label: '۲ نفره' },
        { value: 3, label: '۳ نفره' },
        { value: 4, label: '۴ نفره' },
      ],
      {
        value: count,
        label: 'تعداد بازیکن',
        onChange: (v) => {
          count = v;
          modeControl.classList.toggle('hidden', count !== 2);
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
        label: 'سطح تخته',
        onChange: (v) => {
          level = v;
          variant = VARIANTS[level];
          positions = positions.map(() => 0);
          reset();
        },
      },
    );

    const modeControl = segmented(
      [
        { value: 'ai', label: 'کامپیوتر' },
        { value: 'local', label: 'دو نفره' },
      ],
      {
        value: mode,
        label: 'حریف',
        onChange: (v) => {
          mode = v;
          reset();
        },
      },
    );

    function isHuman(i) {
      if (mode === 'local') return true;
      return i === 0;
    }

    function name(i) {
      if (mode === 'local') return i === 0 ? 'بازیکن ۱' : `بازیکن ${faNum(i + 1)}`;
      if (i === 0) return 'تو';
      return i === 1 ? 'کامپیوتر' : `کامپیوتر ${faNum(i)}`;
    }

    function reset() {
      if (timer) clearTimeout(timer);
      timer = null;
      positions = Array.from({ length: count }, () => 0);
      turn = 0;
      lastRoll = 0;
      busy = false;
      finished = false;
      paint();
      maybeAi();
    }

    function paint() {
      diceSlot.replaceChildren(lastRoll ? die(lastRoll) : h('span', { class: 'small faint', text: 'تاس نریخته' }));
      rollBtn.disabled = busy || finished || !isHuman(turn);
      boardEl.replaceChildren(buildBoard(), startTray());
      updateStatus();
    }

    function startTray() {
      const starting = positions.map((pos, i) => (pos === 0 ? i : -1)).filter((i) => i >= 0);
      if (!starting.length) return h('div');
      return h(
        'div',
        { class: 'snakes-start' },
        h('span', { class: 'small faint', text: 'شروع:' }),
        ...starting.map((i) => h('span', { class: `snake-token-tray token-${COLORS[i]}`, title: name(i) })),
      );
    }

    function updateStatus() {
      if (finished) return;
      const p = positions[turn];
      if (!isHuman(turn)) statusEl.innerHTML = `<strong>${name(turn)}</strong> در حال تاس ریختن…`;
      else statusEl.innerHTML = `نوبت <strong>${name(turn)}</strong> — خانه‌ی ${faNum(p)}.`;
    }

    function buildBoard() {
      const grid = h('div', { class: 'snakes-grid', role: 'grid', 'aria-label': 'تخته‌ی مار و پله' });
      for (let dr = 0; dr < SIZE; dr++) {
        for (let dc = 0; dc < SIZE; dc++) {
          const num = numberAt(dr, dc);
          const cls = ['snake-cell'];
          if (variant.ladders.has(num)) cls.push('is-ladder');
          if (variant.snakes.has(num)) cls.push('is-snake');
          grid.append(h('div', { class: cls.join(' '), role: 'gridcell', 'aria-label': `خانه ${faNum(num)}` }, h('span', { class: 'snake-num', text: faNum(num) })));
        }
      }

      const overlay = s('svg', {
        class: 'snakes-overlay',
        viewBox: `0 0 ${SIZE} ${SIZE}`,
        preserveAspectRatio: 'none',
        'aria-hidden': 'true',
      });

      const center = (cell) => {
        const { x, y } = displayPos(cell);
        return { x: x + 0.5, y: y + 0.5 };
      };

      for (const [from, to] of variant.ladders) {
        const a = center(from);
        const b = center(to);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * 0.16;
        const ny = (dx / len) * 0.16;
        overlay.append(
          s('line', { x1: a.x + nx, y1: a.y + ny, x2: b.x + nx, y2: b.y + ny, class: 'ladder-rail' }),
          s('line', { x1: a.x - nx, y1: a.y - ny, x2: b.x - nx, y2: b.y - ny, class: 'ladder-rail' }),
        );
        for (let t = 0.12; t < 1; t += 0.19) {
          const x = a.x + dx * t;
          const y = a.y + dy * t;
          overlay.append(s('line', { x1: x + nx, y1: y + ny, x2: x - nx, y2: y - ny, class: 'ladder-rung' }));
        }
      }

      for (const [from, to] of variant.snakes) {
        const a = center(from);
        const b = center(to);
        const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.22;
        const my = (a.y + b.y) / 2 - (b.x - a.x) * 0.22;
        overlay.append(
          s('path', {
            d: `M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`,
            class: 'snake-body',
          }),
          s('circle', { cx: a.x, cy: a.y, r: 0.13, class: 'snake-head' }),
        );
      }

      const wrap = h('div', { class: 'snakes-board' }, grid, overlay);

      const tokens = h('div', { class: 'snakes-tokens', 'aria-hidden': 'true' });
      positions.forEach((pos, i) => {
        if (pos <= 0) return;
        const { x, y } = displayPos(pos);
        const offset = (i - (count - 1) / 2) * 0.26;
        const el = h('span', {
          class: `snake-token token-${COLORS[i]}`,
          style: {
            left: `${((x + 0.5) / SIZE) * 100 + offset * 3}%`,
            top: `${((y + 0.5) / SIZE) * 100 + offset * 3}%`,
          },
        });
        tokens.append(el);
      });
      wrap.append(tokens);
      return wrap;
    }

    function roll() {
      if (busy || finished || !isHuman(turn)) return;
      doRoll();
    }

    function doRoll() {
      busy = true;
      lastRoll = 1 + Math.floor(Math.random() * 6);
      play('dice');
      paint();
      timer = setTimeout(() => {
        timer = null;
        const res = applyRoll(positions[turn], lastRoll, variant);
        busy = false;
        if (res.moved) {
          positions[turn] = res.pos;
          if (res.jumped) setTimeout(() => play(res.pos > res.landed ? 'correct' : 'wrong'), 120);
        }
        if (positions[turn] === 100) {
          finish(turn);
          paint();
          return;
        }
        const extra = lastRoll === 6;
        if (!extra) turn = (turn + 1) % count;
        paint();
        maybeAi();
      }, 520);
    }

    function maybeAi() {
      if (finished) return;
      if (isHuman(turn)) return;
      timer = setTimeout(() => {
        timer = null;
        if (!finished) doRoll();
      }, 700);
    }

    function finish(winner) {
      finished = true;
      if (mode === 'ai') ctx.record(winner === 0 ? 'win' : 'loss');
      play(winner === 0 || mode === 'local' ? 'win' : 'lose');
      openModal({
        title: 'پایان بازی',
        body: h('p', { text: `${name(winner)} زودتر به خانه‌ی صد رسید.` }),
        actions: [
          { label: 'بازی جدید', variant: 'primary', onClick: reset },
          { label: 'بستن', variant: 'ghost' },
        ],
      });
    }

    root.append(
      h(
        'div',
        { class: 'game' },
        h('div', { class: 'game-bar' }, h('div', { class: 'bar-group' }, countControl, modeControl, levelControl), h('div', { class: 'bar-group' }, btn('شروع دوباره', { variant: 'soft', onClick: reset }))),
        statusEl,
        h('div', { class: 'game-body' }, boardEl, h('div', { class: 'dice-row' }, diceSlot, rollBtn)),
      ),
    );

    paint();

    return () => {
      if (timer) clearTimeout(timer);
    };
  },
};
