import { h, s, btn, segmented, openModal, toast } from '../../core/ui.js';
import { faNum } from '../../core/i18n.js';
import { play } from '../../core/sound.js';
import { die } from '../../core/dice.js';
import {
  createState,
  legalSingles,
  applySingle,
  roll,
  randomRoll,
  passTurn,
  bestTurn,
  pipCount,
  PIECES,
  scoreKind,
} from './engine.js';

const WIDTH = 900;
const HEIGHT = 560;
const PAD_X = 18;
const PAD_TOP = 46;
const PAD_BOTTOM = 46;
const BAR_W = 68;
const BOARD_TOP = PAD_TOP;
const BOARD_BOTTOM = HEIGHT - PAD_BOTTOM;
const CENTER_Y = HEIGHT / 2;
const HALF_W = (WIDTH - PAD_X * 2 - BAR_W) / 2;
const COL_W = HALF_W / 6;
const LEFT_X = PAD_X;
const RIGHT_X = PAD_X + HALF_W + BAR_W;
const BAR_X = PAD_X + HALF_W;

function pointCoords(index) {
  const top = index >= 12;
  const right = index >= 18 || index <= 5;
  const slot = right ? (top ? index - 18 : 5 - index) : top ? index - 12 : 11 - index;
  const x0 = (right ? RIGHT_X : LEFT_X) + slot * COL_W;
  return {
    x0,
    x1: x0 + COL_W,
    base: top ? BOARD_TOP : BOARD_BOTTOM,
    apex: CENTER_Y,
    dir: top ? 1 : -1,
    center: x0 + COL_W / 2,
  };
}

function checkerY(dir, i) {
  return dir === 1 ? BOARD_TOP + 28 + i * 31 : BOARD_BOTTOM - 28 - i * 31;
}

export default {
  id: 'backgammon',
  title: 'تخته نرد',
  subtitle: 'دو تاس، پانزده مهره، یک برنده',
  meta: 'دو نفره یا کامپیوتر',
  keywords: ['تخته نرد', 'نرد', 'تاس'],
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3.5 4.5h17v15h-17z"/><path d="M3.5 12h17M8.6 4.5v7.5M15.4 12v7.5"/><circle cx="6" cy="8" r=".9" fill="currentColor"/><circle cx="14" cy="8.3" r=".9" fill="currentColor"/><circle cx="10.8" cy="5.6" r=".9" fill="currentColor"/><circle cx="11" cy="17" r=".9" fill="currentColor"/><circle cx="18.5" cy="15.5" r=".9" fill="currentColor"/></svg>',
  mount(root, ctx) {
    const saved = ctx.load();
    let state = createState();
    if (saved && saved.state && Array.isArray(saved.state.points) && saved.state.points.length === 24) {
      state = saved.state;
      toast('ادامه‌ی بازی قبلی');
    }
    let mode = 'ai';
    let level = 'normal';
    let selectedFrom = null;
    let busy = false;
    let over = false;
    let timer = null;

    const boardWrap = h('div', { class: 'bg-wrap' });
    let rollAnimation = false;
    const statusEl = h('div', { class: 'game-status', role: 'status' });
    const scoresEl = h('div', { class: 'scores' });

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
      ],
      {
        value: level,
        label: 'سطح',
        onChange: (v) => {
          level = v;
        },
      },
    );

    const rollBtn = btn('تاس بریز', { variant: 'primary', onClick: humanRoll });
    const passBtn = btn('عبور', { variant: 'soft', onClick: () => { state = passTurn(state); render(); save(); } });
    passBtn.classList.add('hidden');

    function reset() {
      if (timer) clearTimeout(timer);
      timer = null;
      state = createState();
      selectedFrom = null;
      busy = false;
      over = false;
      ctx.clearSave();
      render();
      maybeAi();
    }

    function persist() {
      if (over) return;
      ctx.save({ state });
    }

    function save() {
      persist();
    }

    function buildDiceOverlay() {
      const overlay = h('div', { class: `bg-dice-overlay ${rollAnimation ? 'is-rolling' : ''}`.trim(), 'aria-hidden': 'true' });
      rollAnimation = false;
      if (state.dice.length) {
        overlay.append(h('div', { class: 'bg-dice-plate' }, ...state.dice.map((value) => die(value))));
      }
      return overlay;
    }

    function render() {
      boardWrap.replaceChildren(buildBoard(), buildDiceOverlay());
      rollBtn.disabled = busy || over || state.turn !== 'w' && mode === 'ai' || state.dice.length > 0;
      if (!state.dice.length) {
        rollBtn.textContent = 'تاس بریز';
      } else if (!legalSingles(state).length) {
        rollBtn.textContent = 'حرکتی نیست';
      } else {
        rollBtn.textContent = 'تاس در بازی';
      }
      passBtn.classList.toggle('hidden', !(state.dice.length && !legalSingles(state).length));
      renderStatus();
      renderScores();
    }

    function renderStatus() {
      if (over) return;
      if (busy) {
        statusEl.textContent = 'کامپیوتر دارد بازی می‌کند…';
        return;
      }
      const diceText = state.dice.length ? ` · تاس: ${state.dice.map((v) => faNum(v)).join(' و ')}` : '';
      if (mode === 'ai') {
        statusEl.innerHTML = `${state.turn === 'w' ? 'نوبت تو — سفید.' : 'نوبت کامپیوتر — سیاه.'}${diceText}`;
      } else {
        statusEl.innerHTML = `نوبت <strong>${state.turn === 'w' ? 'سفید' : 'سیاه'}</strong>${diceText}.`;
      }
    }

    function renderScores() {
      scoresEl.replaceChildren(
        h(
          'div',
          { class: `score ${state.turn === 'w' ? 'is-turn' : ''}`.trim() },
          h('span', { class: 'score-label' }, h('span', { class: 'dot dot-1' }), 'سفید'),
          h('span', { class: 'score-value', text: faNum(pipCount(state, 'w')) }),
          h('span', { class: 'small muted', text: `خروج: ${faNum(state.off.w)} · روی میله: ${faNum(state.bar.w)}` }),
        ),
        h(
          'div',
          { class: `score ${state.turn === 'b' ? 'is-turn' : ''}`.trim() },
          h('span', { class: 'score-label' }, h('span', { class: 'dot dot-2' }), mode === 'ai' ? 'سیاه (کامپیوتر)' : 'سیاه'),
          h('span', { class: 'score-value', text: faNum(pipCount(state, 'b')) }),
          h('span', { class: 'small muted', text: `خروج: ${faNum(state.off.b)} · روی میله: ${faNum(state.bar.b)}` }),
        ),
      );
    }

    function buildBoard() {
      const svg = s('svg', {
        class: 'bg-board',
        viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
        role: 'group',
        'aria-label': 'صفحه‌ی تخته نرد',
      });

      const defs = s('defs');
      defs.append(
        s(
          'linearGradient',
          { id: 'bgWood', x1: '0', y1: '0', x2: '0', y2: '1' },
          s('stop', { offset: '0', 'stop-color': '#8A5B33' }),
          s('stop', { offset: '0.55', 'stop-color': '#5B3A1C' }),
          s('stop', { offset: '1', 'stop-color': '#372010' }),
        ),
        s(
          'radialGradient',
          { id: 'bgFelt', cx: '0.35', cy: '0.15', r: '1' },
          s('stop', { offset: '0', 'stop-color': '#1E7F60' }),
          s('stop', { offset: '0.55', 'stop-color': '#0E5B45' }),
          s('stop', { offset: '1', 'stop-color': '#06332A' }),
        ),
        s(
          'linearGradient',
          { id: 'bgIvory', x1: '0', y1: '0', x2: '0', y2: '1' },
          s('stop', { offset: '0', 'stop-color': '#FFFDF3' }),
          s('stop', { offset: '0.55', 'stop-color': '#EDE0C6' }),
          s('stop', { offset: '1', 'stop-color': '#CBB68F' }),
        ),
        s(
          'linearGradient',
          { id: 'bgEbony', x1: '0', y1: '0', x2: '0', y2: '1' },
          s('stop', { offset: '0', 'stop-color': '#544233' }),
          s('stop', { offset: '0.5', 'stop-color': '#2A2018' }),
          s('stop', { offset: '1', 'stop-color': '#120E09' }),
        ),
        s(
          'linearGradient',
          { id: 'bgBrass', x1: '0', y1: '0', x2: '1', y2: '0' },
          s('stop', { offset: '0', 'stop-color': '#8A6526' }),
          s('stop', { offset: '0.5', 'stop-color': '#E5C484' }),
          s('stop', { offset: '1', 'stop-color': '#8A6526' }),
        ),
      );
      svg.append(defs);

      // قاب چوبی و درز وسط تخته
      svg.append(s('rect', { x: 0, y: 0, width: WIDTH, height: HEIGHT, rx: 26, fill: 'url(#bgWood)' }));
      svg.append(s('line', { x1: WIDTH / 2, y1: 8, x2: WIDTH / 2, y2: HEIGHT - 8, class: 'bg-seam' }));
      svg.append(
        s('circle', { cx: WIDTH / 2, cy: 14, r: 4, class: 'bg-hinge' }),
        s('circle', { cx: WIDTH / 2, cy: HEIGHT - 14, r: 4, class: 'bg-hinge' }),
      );

      // دو نیمه‌ی زمین، جدا از هم
      svg.append(
        s('rect', {
          x: LEFT_X - 4,
          y: BOARD_TOP - 4,
          width: HALF_W + 4,
          height: BOARD_BOTTOM - BOARD_TOP + 8,
          rx: 10,
          fill: 'url(#bgFelt)',
          stroke: '#062c22',
          'stroke-width': 2,
        }),
      );
      svg.append(
        s('rect', {
          x: RIGHT_X,
          y: BOARD_TOP - 4,
          width: HALF_W + 4,
          height: BOARD_BOTTOM - BOARD_TOP + 8,
          rx: 10,
          fill: 'url(#bgFelt)',
          stroke: '#062c22',
          'stroke-width': 2,
        }),
      );
      svg.append(
        s('rect', {
          x: LEFT_X,
          y: BOARD_TOP,
          width: HALF_W,
          height: BOARD_BOTTOM - BOARD_TOP,
          fill: 'none',
          stroke: 'rgba(255,255,255,0.10)',
          'stroke-width': 1,
        }),
      );
      svg.append(
        s('rect', {
          x: RIGHT_X,
          y: BOARD_TOP,
          width: HALF_W,
          height: BOARD_BOTTOM - BOARD_TOP,
          fill: 'none',
          stroke: 'rgba(255,255,255,0.10)',
          'stroke-width': 1,
        }),
      );

      // میله‌ی وسط
      svg.append(s('rect', { x: BAR_X, y: BOARD_TOP - 4, width: BAR_W, height: BOARD_BOTTOM - BOARD_TOP + 8, rx: 6, fill: 'url(#bgBrass)', class: 'bg-bar' }));

      const targets = new Map();
      if (selectedFrom !== null && state.turn === 'w') {
        for (const mv of legalSingles(state)) {
          if (String(mv.from) === String(selectedFrom)) {
            if (!targets.has(mv.to)) targets.set(mv.to, []);
            targets.get(mv.to).push(mv);
          }
        }
      }

      // خانه‌ها و مهره‌ها
      for (let index = 0; index < 24; index++) {
        const g = pointCoords(index);
        const classes = ['bg-point', index % 2 === 0 ? 'bg-point-a' : 'bg-point-b'];
        if (index >= 18 || index <= 5) classes.push('bg-point-home');
        const poly = `${g.x0 + 2},${g.base} ${g.x1 - 2},${g.base} ${g.center},${g.apex}`;
        svg.append(s('polygon', { points: poly, class: classes.join(' ') }));

        if (selectedFrom === index) svg.append(s('polygon', { points: poly, class: 'bg-point-selected' }));
        if (targets.has(index)) svg.append(s('polygon', { points: poly, class: 'bg-point-target' }));

        const point = state.points[index];
        if (point) {
          const visible = Math.min(point.n, 5);
          for (let i = 0; i < visible; i++) {
            const disc = s('circle', {
              cx: g.center,
              cy: checkerY(g.dir, i),
              r: 17,
              class: `bg-checker bg-checker-${point.color}`,
            });
            disc.addEventListener('click', () => onPoint(index));
            svg.append(disc);
          }
          if (point.n > 1) {
            const badgeY = checkerY(g.dir, visible - 1) + g.dir * 25;
            const badge = s('circle', { cx: g.center, cy: badgeY, r: 9, class: 'bg-count' });
            badge.addEventListener('click', () => onPoint(index));
            svg.append(
              badge,
              s('text', { x: g.center, y: badgeY + 3.5, class: 'bg-count-text', 'text-anchor': 'middle', text: faNum(point.n) }),
            );
          }
        }

        const hit = s('rect', {
          x: g.x0,
          y: g.dir === 1 ? BOARD_TOP : CENTER_Y,
          width: COL_W,
          height: CENTER_Y - BOARD_TOP,
          class: 'bg-hit',
          'aria-label': `خانه ${faNum(index + 1)}`,
          tabindex: '0',
        });
        hit.addEventListener('click', () => onPoint(index));
        hit.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPoint(index);
          }
        });
        svg.append(hit);
      }

      // مهره‌های روی میله: سفید بالا، سیاه پایین تا جای تاس وسط باز بماند
      const barSlots = Math.min(state.bar.w, 5);
      for (let i = 0; i < barSlots; i++) {
        svg.append(s('circle', { cx: WIDTH / 2, cy: CENTER_Y - 78 - i * 30, r: 15, class: 'bg-checker bg-checker-w' }));
      }
      if (state.bar.w > 5) {
        svg.append(
          s('circle', { cx: WIDTH / 2, cy: CENTER_Y - 78 - 5 * 30, r: 8, class: 'bg-count' }),
          s('text', { x: WIDTH / 2, y: CENTER_Y - 78 - 5 * 30 + 3, class: 'bg-count-text', 'text-anchor': 'middle', text: faNum(state.bar.w) }),
        );
      }
      const barSlotsB = Math.min(state.bar.b, 5);
      for (let i = 0; i < barSlotsB; i++) {
        svg.append(s('circle', { cx: WIDTH / 2, cy: CENTER_Y + 78 + i * 30, r: 15, class: 'bg-checker bg-checker-b' }));
      }
      if (state.bar.b > 5) {
        svg.append(
          s('circle', { cx: WIDTH / 2, cy: CENTER_Y + 78 + 5 * 30, r: 8, class: 'bg-count' }),
          s('text', { x: WIDTH / 2, y: CENTER_Y + 78 + 5 * 30 + 3, class: 'bg-count-text', 'text-anchor': 'middle', text: faNum(state.bar.b) }),
        );
      }
      const barHit = s('rect', { x: BAR_X, y: BOARD_TOP, width: BAR_W, height: BOARD_BOTTOM - BOARD_TOP, class: 'bg-hit', 'aria-label': 'میله' });
      barHit.addEventListener('click', () => onBar());
      svg.append(barHit);

      // سینی‌های خروج در قاب بالا و پایین، سمت خانه‌ها
      const drawTray = (y, color, label, count) => {
        svg.append(s('rect', { x: RIGHT_X, y, width: HALF_W, height: 24, rx: 6, class: `bg-off bg-off-${color}` }));
        svg.append(
          s('text', { x: RIGHT_X + HALF_W / 2, y: y + 16, class: 'bg-off-label', 'text-anchor': 'middle', text: `${label} · ${faNum(count)}` }),
        );
        svg.append(s('circle', { cx: RIGHT_X + HALF_W - 14, cy: y + 12, r: 6, class: `bg-tray-dot bg-tray-dot-${color}` }));
        const hit = s('rect', { x: RIGHT_X, y, width: HALF_W, height: 24, class: 'bg-hit', 'aria-label': label });
        hit.addEventListener('click', () => onOff());
        svg.append(hit);
      };
      drawTray(12, 'w', 'خروج سفید', state.off.w);
      drawTray(HEIGHT - 36, 'b', 'خروج سیاه', state.off.b);

      return svg;
    }

    function onPoint(index) {
      if (busy || over) return;
      if (mode === 'ai' && state.turn !== 'w') return;
      if (!state.dice.length) {
        toast('اول تاس بریز');
        return;
      }
      const singles = legalSingles(state);

      if (state.bar.w > 0) {
        const canEnter = selectedFrom === 'bar' && singles.some((m) => m.from === 'bar' && m.to === index);
        if (!canEnter) {
          selectedFrom = 'bar';
          toast('اول مهره‌های روی میله را وارد کن');
          render();
          return;
        }
      }

      if (selectedFrom !== null) {
        const match = singles.find((m) => String(m.from) === String(selectedFrom) && m.to === index);
        if (match) {
          makeMove(match);
          return;
        }
      }

      const point = state.points[index];
      const own = point && point.color === 'w';
      const canSelect = singles.some((m) => String(m.from) === String(index));
      if (own && canSelect) {
        selectedFrom = index;
        play('click');
      } else {
        selectedFrom = null;
      }
      render();
    }

    function onBar() {
      if (busy || over || state.turn !== 'w' || !state.bar.w) return;
      if (!state.dice.length) {
        toast('اول تاس بریز');
        return;
      }
      selectedFrom = 'bar';
      render();
    }

    function onOff() {
      if (busy || over || selectedFrom === null) return;
      const match = legalSingles(state).find((m) => String(m.from) === String(selectedFrom) && m.to === 'off');
      if (match) makeMove(match);
    }

    function makeMove(mv) {
      state = applySingle(state, mv);
      selectedFrom = null;
      play(mv.to === 'off' ? 'correct' : 'move');
      render();
      save();
      if (state.off.w >= PIECES) {
        finish('w');
        return;
      }
      if (state.off.b >= PIECES) {
        finish('b');
        return;
      }
      if (state.turn === 'w' && state.dice.length && !legalSingles(state).length) {
        toast('برای این تاس حرکتی نبود');
        state = passTurn(state);
        render();
        save();
      }
      if (state.turn === 'b') {
        selectedFrom = null;
        maybeAi();
      }
    }

    function humanRoll() {
      if (busy || over || state.dice.length) return;
      if (mode === 'ai' && state.turn !== 'w') return;
      state = roll(state, randomRoll(2));
      rollAnimation = true;
      play('dice');
      render();
      save();
      if (!legalSingles(state).length) {
        toast('با این تاس حرکتی نداری؛ نوبت می‌گذرد');
        timer = setTimeout(() => {
          timer = null;
          state = passTurn(state);
          render();
          save();
          maybeAi();
        }, 900);
      }
    }

    function maybeAi() {
      if (over || mode !== 'ai' || state.turn !== 'b' || busy) return;
      busy = true;
      render();
      const needRoll = !state.dice.length;
      timer = setTimeout(() => {
        timer = null;
        if (needRoll) {
          state = roll(state, randomRoll(2));
          rollAnimation = true;
          play('dice');
          render();
        }
        timer = setTimeout(() => {
          timer = null;
          if (over) {
            busy = false;
            return;
          }
          const turn = bestTurn(state, { level });
          busy = false;
          if (!turn) {
            state = passTurn(state);
            render();
            save();
            return;
          }
          state = turn.state;
          play(turn.moves.length ? 'move' : 'tick');
          render();
          save();
          if (state.off.b >= PIECES) {
            finish('b');
            return;
          }
          if (state.off.w >= PIECES) {
            finish('w');
            return;
          }
          if (state.turn === 'b' && !over) {
            timer = setTimeout(() => {
              timer = null;
              maybeAi();
            }, 520);
          }
        }, needRoll ? 420 : 120);
      }, needRoll ? 620 : 200);
    }

    function finish(winner) {
      if (over) return;
      over = true;
      busy = false;
      ctx.clearSave();
      const kind = scoreKind(state, winner);
      const humanWon = winner === 'w';
      if (mode === 'ai') ctx.record(humanWon ? 'win' : 'loss');
      play(humanWon || mode === 'local' ? 'win' : 'lose');
      const kindText = kind === 'backgammon' ? 'بک‌گمون' : kind === 'gammon' ? 'گمون' : 'برد معمولی';
      openModal({
        title: humanWon || mode === 'local' ? `${winner === 'w' ? 'سفید' : 'سیاه'} برد` : 'باختی',
        body: h('p', { text: `نوع برد: ${kindText}` }),
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
        h(
          'div',
          { class: 'game-bar' },
          h('div', { class: 'bar-group' }, modeControl, levelControl),
          h('div', { class: 'bar-group' }, rollBtn, passBtn, btn('بازی جدید', { variant: 'ghost', onClick: reset })),
        ),
        statusEl,
        h('div', { class: 'game-body' }, boardWrap),
        h('p', { class: 'small faint center', text: 'سفید از پایین به بالا و سیاه بر عکس حرکت می‌کند. برای خروج، روی سینی «خروج» بزن.' }),
        scoresEl,
      ),
    );

    render();
    if (state.turn === 'b' && mode === 'ai' && !over) maybeAi();

    return () => {
      if (timer) clearTimeout(timer);
    };
  },
};
