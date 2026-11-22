import { h, s, btn, segmented, openModal, toast } from '../../core/ui.js';
import { faNum } from '../../core/i18n.js';
import { play } from '../../core/sound.js';
import { die } from '../../core/dice.js';
import {
  TRACK,
  GOAL,
  STARTS,
  SAFE,
  createGame,
  legalMoves,
  startRoll,
  applyMove,
  passTurn,
  aiPick,
  capturesAt,
  finishedCount,
} from './engine.js';

const CX = 350;
const CY = 350;
const RING_R = 258;
const HOME_RADII = [190, 158, 126, 94, 62];
const YARD_R = 332;
const COLORS = ['p1', 'p2', 'p3', 'p4'];

function polar(angleDeg, radius) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
}

function ringPos(index) {
  return polar((index / TRACK) * 360, RING_R);
}

function startAngle(player) {
  return (STARTS[player] / TRACK) * 360;
}

function yardCenter(player) {
  return polar(startAngle(player) - 45, YARD_R);
}

function tokenPositions(game, player, pieceIndex) {
  const steps = game.pieces[player][pieceIndex];
  if (steps === -1) {
    const c = yardCenter(player);
    const slot = pieceIndex;
    return { x: c.x + (slot % 2 === 0 ? -20 : 20), y: c.y + (slot < 2 ? -20 : 20) };
  }
  if (steps <= TRACK - 1) {
    const cell = (STARTS[player] + steps) % TRACK;
    const p = ringPos(cell);
    const offset = pieceIndex * 1.6 - 2.4;
    return { x: p.x + offset, y: p.y + offset };
  }
  if (steps < GOAL) {
    const p = polar(startAngle(player), HOME_RADII[steps - TRACK]);
    return { x: p.x, y: p.y + pieceIndex * 1.4 };
  }
  const p = polar(startAngle(player) + 90, 10 + pieceIndex * 3);
  return p;
}

function yardRect(player) {
  const c = yardCenter(player);
  return { x: c.x - 44, y: c.y - 44, w: 88, h: 88 };
}

export default {
  id: 'manch',
  title: 'منچ',
  subtitle: 'چهار مهره را تا خانه‌ی آخر برسان',
  meta: '۲ تا ۴ نفره',
  keywords: ['منچ', 'تخته', 'تاس'],
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/><circle cx="5" cy="12" r="1.5" fill="currentColor"/><path d="M12 12l3.5-3.5"/></svg>',
  mount(root, ctx) {
    let humans = 1;
    let aiLevel = 'normal';
    let game = createGame(humans);
    let roll = 0;
    let moves = [];
    let busy = false;
    let over = false;
    let timer = null;

    const boardWrap = h('div', { class: 'manch-wrap' });
    const diceSlot = h('div', { class: 'dice-slot' });
    const statusEl = h('div', { class: 'game-status', role: 'status' });
    const scoreEl = h('div', { class: 'scores' });

    const aiLevelControl = segmented(
      [
        { value: 'easy', label: 'آسان' },
        { value: 'normal', label: 'معمولی' },
        { value: 'hard', label: 'سخت' },
      ],
      {
        value: aiLevel,
        label: 'سطح کامپیوتر',
        onChange: (v) => {
          aiLevel = v;
        },
      },
    );

    const humansControl = segmented(
      [
        { value: 1, label: '۱ نفر' },
        { value: 2, label: '۲ نفر' },
        { value: 3, label: '۳ نفر' },
        { value: 4, label: '۴ نفر' },
      ],
      {
        value: humans,
        label: 'بازیکن‌های انسانی',
        onChange: (v) => {
          humans = v;
          reset();
        },
      },
    );

    const rollBtn = btn('تاس بریز', { variant: 'primary', onClick: humanRoll });
    const passBtn = btn('عبور', { variant: 'soft', onClick: () => { game = passTurn(game); roll = 0; moves = []; render(); maybeAi(); } });
    passBtn.classList.add('hidden');

    function reset() {
      if (timer) clearTimeout(timer);
      timer = null;
      game = createGame(humans);
      roll = 0;
      moves = [];
      busy = false;
      over = false;
      render();
      maybeAi();
    }

    function isHuman(player) {
      return game.seats[player].kind === 'human';
    }

    function colorClass(player) {
      return `m-${COLORS[player]}`;
    }

    function render() {
      boardWrap.replaceChildren(buildBoard());
      diceSlot.replaceChildren(roll ? die(roll) : h('span', { class: 'small faint', text: 'تاس نریخته' }));
      scoreEl.replaceChildren(
        ...game.seats.map((seat, p) =>
          h(
            'div',
            { class: `score ${game.turn === p && !over ? 'is-turn' : ''}` },
            h('span', { class: 'score-label' }, h('span', { class: `dot dot-${p + 1}` }), seat.name),
            h('span', { class: 'score-value', text: `${faNum(finishedCount(game, p))}/۴` }),
          ),
        ),
      );
      updateStatus();
      rollBtn.disabled = busy || over || !isHuman(game.turn) || moves.length > 0;
      passBtn.classList.toggle('hidden', !(isHuman(game.turn) && roll && !moves.length));
    }

    function updateStatus() {
      if (over) return;
      const seat = game.seats[game.turn];
      if (busy) statusEl.textContent = `${seat.name} دارد بازی می‌کند…`;
      else if (moves.length) statusEl.innerHTML = `با تاس <strong>${faNum(roll)}</strong> یک مهره را انتخاب کن.`;
      else statusEl.innerHTML = `نوبت <strong>${seat.name}</strong> — تاس بریز.`;
    }

    function buildBoard() {
      const svg = s('svg', { class: 'manch-board', viewBox: '0 0 700 700', role: 'group', 'aria-label': 'صفحه‌ی منچ' });

      // مسیر
      for (let i = 0; i < TRACK; i++) {
        const p = ringPos(i);
        const cls = ['mring-cell'];
        if (SAFE.has(i)) cls.push('is-safe');
        const owner = STARTS.findIndex((start) => start === i);
        if (owner >= 0) cls.push(`is-start`, colorClass(owner));
        svg.append(s('rect', { x: p.x - 14, y: p.y - 14, width: 28, height: 28, rx: 6, class: cls.join(' '), transform: `rotate(${(i / TRACK) * 360}, ${p.x}, ${p.y})` }));
      }

      // راه خانه‌ها
      for (let player = 0; player < 4; player++) {
        for (let k = 0; k < HOME_RADII.length; k++) {
          const p = polar(startAngle(player), HOME_RADII[k]);
          svg.append(s('rect', { x: p.x - 14, y: p.y - 14, width: 28, height: 28, rx: 6, class: `mhome-cell ${colorClass(player)}` }));
        }
      }

      // حیاط‌ها
      for (let player = 0; player < 4; player++) {
        const r = yardRect(player);
        svg.append(s('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 18, class: `myard ${colorClass(player)}` }));
        svg.append(s('text', { x: r.x + r.w / 2, y: r.y + r.h + 18, 'text-anchor': 'middle', class: 'myard-label', text: faNum(player + 1) }));
      }

      // خانه‌ی آخر
      svg.append(s('circle', { cx: CX, cy: CY, r: 26, class: 'mgoal' }));
      svg.append(s('text', { x: CX, y: CY + 5, 'text-anchor': 'middle', class: 'mgoal-text', text: 'پایان' }));

      // مهره‌ها
      const selectable = new Set(isHuman(game.turn) && moves.length ? moves.map((m) => m.piece) : []);
      const groups = [[], [], [], []];
      for (let player = 0; player < 4; player++) {
        for (let piece = 0; piece < 4; piece++) {
          const pos = tokenPositions(game, player, piece);
          if (game.pieces[player][piece] <= TRACK - 1 && game.pieces[player][piece] >= 0) groups[player].push({ player, piece, pos });
          else {
            const token = s('circle', {
              cx: pos.x,
              cy: pos.y,
              r: 12,
              class: `mtoken ${colorClass(player)} ${selectable.has(piece) && player === game.turn ? 'is-selectable' : ''}`.trim(),
            });
            if (selectable.has(piece) && player === game.turn) {
              token.addEventListener('click', () => choosePiece(piece));
              token.setAttribute('tabindex', '0');
              token.setAttribute('role', 'button');
              token.setAttribute('aria-label', `مهره ${faNum(piece + 1)}`);
            }
            svg.append(token);
          }
        }
      }
      const seen = new Map();
      for (const player of [0, 1, 2, 3]) {
        for (const entry of groups[player]) {
          if (!selectable.has(entry.piece) || player !== game.turn) continue;
          const key = `${Math.round(entry.pos.x)},${Math.round(entry.pos.y)}`;
          const n = seen.get(key) || 0;
          seen.set(key, n + 1);
          const token = s('circle', {
            cx: entry.pos.x,
            cy: entry.pos.y - n * 4,
            r: 12,
            class: `mtoken ${colorClass(player)} is-selectable`,
            tabindex: '0',
            role: 'button',
            'aria-label': `مهره ${faNum(entry.piece + 1)}`,
          });
          token.addEventListener('click', () => choosePiece(entry.piece));
          svg.append(token);
        }
      }
      // مهره‌های غیرقابل‌انتخاب روی مسیر
      for (const player of [0, 1, 2, 3]) {
        for (const entry of groups[player]) {
          if (selectable.has(entry.piece) && player === game.turn) continue;
          svg.append(s('circle', { cx: entry.pos.x, cy: entry.pos.y, r: 12, class: `mtoken ${colorClass(player)}` }));
        }
      }

      return svg;
    }

    function choosePiece(pieceIndex) {
      if (busy || over || !isHuman(game.turn)) return;
      const move = moves.find((m) => m.piece === pieceIndex);
      if (!move) return;
      const hits = capturesAt(game, game.turn, move.to).length;
      game = applyMove(game, move, roll);
      moves = [];
      play(hits ? 'capture' : 'move');
      if (hits) toast('مهره‌ی حریف را زدی!');
      if (game.winner !== null) {
        finish(game.winner);
        return;
      }
      roll = 0;
      render();
      if (!game.winner && game.turn !== undefined) {
        if (game.seats[game.turn].kind === 'ai') maybeAi();
      }
    }

    function humanRoll() {
      if (busy || over || !isHuman(game.turn) || moves.length) return;
      doRoll();
    }

    function doRoll() {
      const value = 1 + Math.floor(Math.random() * 6);
      play('dice');
      const res = startRoll(game, value);
      game = res.game;
      roll = value;
      moves = res.moves || [];
      if (res.skipped) {
        toast('سه شش پشت سر هم! نوبت سوخت.');
        roll = 0;
        moves = [];
        render();
        maybeAi();
        return;
      }
      render();
      if (!moves.length) {
        if (value === 6) {
          roll = 0;
          render();
          toast('شش آوردی ولی حرکتی نبود؛ دوباره تاس بریز');
          if (!isHuman(game.turn)) maybeAi();
          return;
        }
        toast(`با تاس ${faNum(value)} حرکتی نیست`);
        timer = setTimeout(() => {
          timer = null;
          game = passTurn(game);
          roll = 0;
          moves = [];
          render();
          maybeAi();
        }, 950);
      }
    }

    function maybeAi() {
      if (over || busy) return;
      if (game.seats[game.turn].kind !== 'ai') return;
      busy = true;
      render();
      timer = setTimeout(() => {
        timer = null;
        const value = 1 + Math.floor(Math.random() * 6);
        play('dice');
        const res = startRoll(game, value);
        game = res.game;
        roll = value;
        moves = res.moves || [];

        if (res.skipped) {
          roll = 0;
          moves = [];
          busy = false;
          render();
          timer = setTimeout(() => {
            timer = null;
            maybeAi();
          }, 600);
          return;
        }

        if (!moves.length) {
          if (value === 6) {
            roll = 0;
            busy = false;
            render();
            timer = setTimeout(() => {
              timer = null;
              maybeAi();
            }, 450);
            return;
          }
          busy = false;
          render();
          timer = setTimeout(() => {
            timer = null;
            game = passTurn(game);
            roll = 0;
            moves = [];
            render();
            maybeAi();
          }, 650);
          return;
        }

        render();
        timer = setTimeout(() => {
          timer = null;
          const move = aiPick(game, roll, aiLevel);
          if (!move) {
            busy = false;
            render();
            return;
          }
          const hits = capturesAt(game, game.turn, move.to).length;
          game = applyMove(game, move, roll);
          moves = [];
          roll = 0;
          busy = false;
          play(hits ? 'capture' : 'move');
          render();
          if (game.winner !== null) {
            finish(game.winner);
            return;
          }
          timer = setTimeout(() => {
            timer = null;
            maybeAi();
          }, 450);
        }, 650);
      }, 720);
    }

    function finish(winner) {
      over = true;
      busy = false;
      if (timer) clearTimeout(timer);
      timer = null;
      const human = game.seats[winner].kind === 'human';
      if (game.seats.some((seat) => seat.kind === 'human')) ctx.record(human ? 'win' : 'loss');
      play(human ? 'win' : 'lose');
      openModal({
        title: human ? 'بردی' : 'باختی',
        body: h('p', { text: `${game.seats[winner].name} هر چهار مهره را به پایان رساند.` }),
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
        h('div', { class: 'game-bar' }, h('div', { class: 'bar-group' }, humansControl, aiLevelControl), h('div', { class: 'bar-group' }, btn('بازی جدید', { variant: 'ghost', onClick: reset }))),
        statusEl,
        h('div', { class: 'game-body' }, boardWrap, scoreEl, h('div', { class: 'dice-row' }, diceSlot, rollBtn, passBtn)),
      ),
    );

    render();
    maybeAi();

    return () => {
      if (timer) clearTimeout(timer);
    };
  },
};
