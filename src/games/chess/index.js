import { h, btn, segmented, openModal, toast } from '../../core/ui.js';
import { faNum } from '../../core/i18n.js';
import { play } from '../../core/sound.js';
import {
  createInitialState,
  legalMoves,
  makeMove,
  toSan,
  gameStatus,
  positionKey,
  isInCheck,
  fromFen,
  toFen,
  squareName,
} from './engine.js';
import { chooseMove } from './ai.js';

export default {
  id: 'chess',
  title: 'شطرنج',
  subtitle: 'بازی کامل قواعد، با سه سطح حریف',
  meta: 'دو نفره یا کامپیوتر',
  keywords: ['شطرنج', 'مات', 'کیش'],
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M7 20h10M8 17h8l-.8-3.2a3.5 3.5 0 002.3-5.6l-2.1-2.2 1-2.5-2-.8-1.5 1.6h-2L9.4 2.7l-2 .8 1 2.5-2.1 2.2A3.5 3.5 0 008.6 13.8L7.8 17"/></svg>',
  mount(root, ctx) {
    const saved = ctx.load();
    let state = createInitialState();
    let mode = 'ai';
    let level = 'medium';
    let flipped = false;
    let selected = -1;
    let legal = legalMoves(state);
    let history = [];
    let sans = [];
    let keys = [positionKey(state)];
    let lastMove = null;
    let busy = false;
    let over = false;
    let timer = null;

    if (saved && saved.fen) {
      try {
        state = fromFen(saved.fen);
        mode = saved.mode === 'local' ? 'local' : 'ai';
        level = saved.level || 'medium';
        flipped = Boolean(saved.flipped);
        sans = Array.isArray(saved.sans) ? saved.sans : [];
        keys = Array.isArray(saved.keys) && saved.keys.length ? saved.keys : [positionKey(state)];
        legal = legalMoves(state);
        toast('ادامه‌ی بازی قبلی');
      } catch (err) {
        state = createInitialState();
        legal = legalMoves(state);
      }
    }

    const statusEl = h('div', { class: 'game-status', role: 'status' });
    const boardEl = h('div', { class: 'chess-board', role: 'grid', 'aria-label': 'صفحه‌ی شطرنج' });
    const movesEl = h('ol', { class: 'move-list', 'aria-label': 'حرکات' });
    const capturedEl = h('div', { class: 'chess-captured' });

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
          newGame();
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
        },
      },
    );

    levelControl.classList.toggle('hidden', mode !== 'ai');

    function save() {
      if (over) return;
      ctx.save({ fen: toFen(state), mode, level, flipped, sans, keys });
    }

    function targets() {
      if (selected < 0) return new Map();
      const map = new Map();
      for (const move of legal) {
        if (move.from === selected) {
          if (!map.has(move.to)) map.set(move.to, []);
          map.get(move.to).push(move);
        }
      }
      return map;
    }

    function renderCaptured() {
      const initial = { p: 8, n: 2, b: 2, r: 2, q: 1 };
      const counts = { w: {}, b: {} };
      for (const piece of state.board) {
        if (!piece) continue;
        const type = piece.toLowerCase();
        if (type === 'k') continue;
        const color = piece === piece.toUpperCase() ? 'w' : 'b';
        counts[color][type] = (counts[color][type] || 0) + 1;
      }
      const missing = (color) => {
        const out = [];
        for (const [type, total] of Object.entries(initial)) {
          const gone = Math.max(0, total - (counts[color][type] || 0));
          for (let i = 0; i < gone; i++) out.push(type);
        }
        return out;
      };
      const byWhite = missing('b');
      const byBlack = missing('w');
      const value = { p: 1, n: 3, b: 3, r: 5, q: 9 };
      const material =
        byWhite.reduce((sum, type) => sum + value[type], 0) - byBlack.reduce((sum, type) => sum + value[type], 0);

      const name = (color) => {
        if (mode === 'local') return color === 'w' ? 'سفید' : 'سیاه';
        return color === 'w' ? 'تو' : 'کامپیوتر';
      };

      const row = (color, captured, imageColor, balance) =>
        h(
          'div',
          {
            class: `chess-player ${!over && state.turn === color ? 'is-turn' : ''}`.trim(),
            title: `${name(color)}${balance ? ' — مزیت مواد' : ''}`,
          },
          h('span', { class: `dot dot-${color === 'w' ? 'w' : 'b'}` }),
          h('span', { text: name(color) }),
          balance && material !== 0
            ? h('span', { class: 'chip chip-accent', text: `${material > 0 ? '+' : ''}${faNum(material)}` })
            : null,
          h(
            'span',
            { class: 'cap-list' },
            ...captured.map((type) =>
              h('img', {
                src: `assets/pieces/${imageColor}${type.toUpperCase()}.svg`,
                alt: '',
                draggable: 'false',
              }),
            ),
          ),
        );

      const topColor = flipped ? 'w' : 'b';
      const bottomColor = flipped ? 'b' : 'w';
      const capturedBy = (color) => (color === 'w' ? byWhite : byBlack);
      const imageFor = (color) => (color === 'w' ? 'b' : 'w');
      const advantage = (color) => (color === 'w' ? material : -material);
      capturedEl.replaceChildren(
        row(topColor, capturedBy(topColor), imageFor(topColor), advantage(topColor) > 0),
        row(bottomColor, capturedBy(bottomColor), imageFor(bottomColor), advantage(bottomColor) > 0),
      );
    }

    function paint() {
      const map = targets();
      renderCaptured();
      const checkSq = isInCheck(state) ? state.board.indexOf(state.turn === 'w' ? 'K' : 'k') : -1;
      const cells = [];
      const order = [];
      for (let i = 0; i < 64; i++) order.push(i);
      if (flipped) order.reverse();

      for (const i of order) {
        const r = i >> 3;
        const c = i & 7;
        const piece = state.board[i];
        const cls = ['chess-sq', (r + c) % 2 === 0 ? 'is-light' : 'is-dark'];
        if (i === selected) cls.push('is-selected');
        if (lastMove && (i === lastMove.from || i === lastMove.to)) cls.push('is-last');
        if (map.has(i)) cls.push(piece ? 'is-capture' : 'is-target');
        if (i === checkSq) cls.push('is-check');

        const isBottomRow = flipped ? r === 0 : r === 7;
        const isEdgeCol = flipped ? c === 7 : c === 0;

        const coords = [];
        if (isBottomRow) coords.push(h('span', { class: 'coord coord-file', 'aria-hidden': 'true', text: 'abcdefgh'[c] }));
        if (isEdgeCol) coords.push(h('span', { class: 'coord coord-rank', 'aria-hidden': 'true', text: String(8 - r) }));

        const cell = h(
          'button',
          {
            type: 'button',
            class: cls.join(' '),
            role: 'gridcell',
            'aria-label': `${squareName(i)}${piece ? `، ${piece}` : '، خالی'}${i === checkSq ? '، شاه در کیش' : ''}`,
            onClick: () => onSquare(i),
          },
          ...coords,
          piece
            ? h('img', {
                class: 'piece-img',
                src: `assets/pieces/${piece === piece.toUpperCase() ? 'w' : 'b'}${piece.toUpperCase()}.svg`,
                alt: '',
                draggable: 'false',
              })
            : null,
        );
        cells.push(cell);
      }
      boardEl.replaceChildren(...cells);
      renderMoves();
      renderStatus();
    }

    function renderMoves() {
      const rows = [];
      for (let i = 0; i < sans.length; i += 2) {
        rows.push(
          h(
            'li',
            { class: 'move-row' },
            h('span', { class: 'move-no', text: `${faNum(i / 2 + 1)}.` }),
            h('span', { class: 'move-san', text: sans[i] || '' }),
            h('span', { class: 'move-san', text: sans[i + 1] || '' }),
          ),
        );
      }
      if (!rows.length) rows.push(h('li', { class: 'small faint', text: 'هنوز حرکتی انجام نشده.' }));
      if (rows.length) rows[rows.length - 1].classList.add('is-current');
      movesEl.replaceChildren(...rows);
      const list = movesEl.parentElement;
      if (list) list.scrollTop = list.scrollHeight;
    }

    function renderStatus() {
      if (over) return;
      const status = gameStatus(state);
      if (status === 'check') {
        statusEl.innerHTML = `<strong>کیش!</strong> ${state.turn === 'w' ? 'تو' : 'حریف'} باید شاه را نجات دهد.`;
        return;
      }
      if (busy) {
        statusEl.textContent = 'کامپیوتر دارد فکر می‌کند…';
        return;
      }
      if (mode === 'ai') {
        statusEl.innerHTML = state.turn === 'w' ? 'نوبت تو — با <strong>سفید</strong> بازی می‌کنی.' : 'نوبت کامپیوتر (سیاه).';
      } else {
        statusEl.innerHTML = `نوبت <strong>${state.turn === 'w' ? 'سفید' : 'سیاه'}</strong>.`;
      }
    }

    function onSquare(i) {
      if (over || busy) return;
      if (mode === 'ai' && state.turn !== 'w') return;

      const piece = state.board[i];
      const isOwn = piece && (piece === piece.toUpperCase() ? 'w' : 'b') === state.turn;

      if (selected >= 0) {
        const candidates = legal.filter((m) => m.from === selected && m.to === i);
        if (candidates.length) {
          if (candidates.length > 1) {
            askPromotion(candidates);
          } else {
            doMove(candidates[0]);
          }
          return;
        }
      }

      if (isOwn) {
        selected = i;
        paint();
      } else {
        selected = -1;
        paint();
      }
    }

    function askPromotion(candidates) {
      const pick = (letter) => candidates.find((m) => m.promotion && m.promotion.toLowerCase() === letter);
      openModal({
        title: 'ارتقای مهره',
        body: h('p', { text: 'پیاده به کدام مهره تبدیل شود؟' }),
        dismissible: false,
        actions: [
          { label: 'وزیر', variant: 'primary', onClick: () => doMove(pick('q')) },
          { label: 'رخ', onClick: () => doMove(pick('r')) },
          { label: 'فیل', onClick: () => doMove(pick('b')) },
          { label: 'اسب', onClick: () => doMove(pick('n')) },
        ],
      });
    }

    function doMove(move) {
      if (!move) return;
      const san = toSan(state, move, legal);
      history.push({ state, sans: [...sans], keys: [...keys] });
      state = makeMove(state, move);
      sans = [...sans, san];
      keys = [...keys, positionKey(state)];
      lastMove = move;
      selected = -1;
      legal = legalMoves(state);
      play(move.captured ? 'capture' : 'move');
      paint();
      save();

      const status = gameStatus(state);
      if (status === 'check') setTimeout(() => play('check'), 120);
      if (status === 'checkmate') {
        finish(state.turn === 'w' && mode === 'ai' ? 'loss' : 'win', 'کیش و مات');
        return;
      }
      if (status === 'stalemate') {
        finish('draw', 'پات');
        return;
      }
      if (status === 'fifty' || status === 'material') {
        finish('draw', 'تساوی');
        return;
      }
      const key = positionKey(state);
      if (keys.filter((k) => k === key).length >= 3) {
        finish('draw', 'تکرار سه‌باره');
        return;
      }
      if (mode === 'ai' && state.turn === 'b') scheduleAi();
    }

    function scheduleAi() {
      busy = true;
      paint();
      timer = setTimeout(() => {
        timer = null;
        if (over) {
          busy = false;
          return;
        }
        const move = chooseMove(state, { level, timeMs: level === 'hard' ? 900 : 350 });
        busy = false;
        if (!move) {
          paint();
          return;
        }
        doMove(move);
      }, 80);
    }

    function finish(result, reason) {
      over = true;
      busy = false;
      if (timer) clearTimeout(timer);
      timer = null;
      ctx.clearSave();
      if (mode === 'ai') ctx.record(result === 'win' ? 'win' : result === 'loss' ? 'loss' : 'draw');
      play(result === 'win' ? 'win' : result === 'loss' ? 'lose' : 'wrong');
      const title = result === 'win' ? 'بردی' : result === 'loss' ? 'باختی' : 'تساوی';
      const text =
        reason === 'کیش و مات'
          ? result === 'win'
            ? 'شاه حریف مات شد.'
            : 'شاه تو مات شد.'
          : reason === 'پات'
            ? 'حریف حرکتی ندارد اما شاه در کیش نیست؛ بازی مساوی شد.'
            : reason;
      selected = -1;
      paint();
      statusEl.textContent = `${title} — ${text}`;
      openModal({
        title,
        body: h('p', { text }),
        actions: [
          { label: 'بازی جدید', variant: 'primary', onClick: newGame },
          { label: 'بستن', variant: 'ghost' },
        ],
      });
    }

    function undo() {
      if (busy || !history.length) return;
      if (timer) clearTimeout(timer);
      timer = null;
      busy = false;
      const steps = mode === 'ai' && history.length >= 2 ? 2 : 1;
      for (let i = 0; i < steps; i++) {
        const snap = history.pop();
        if (!snap) break;
        state = snap.state;
        sans = snap.sans;
        keys = snap.keys;
      }
      selected = -1;
      lastMove = null;
      over = false;
      legal = legalMoves(state);
      paint();
      save();
    }

    function newGame() {
      if (timer) clearTimeout(timer);
      timer = null;
      state = createInitialState();
      selected = -1;
      legal = legalMoves(state);
      history = [];
      sans = [];
      keys = [positionKey(state)];
      lastMove = null;
      busy = false;
      over = false;
      ctx.clearSave();
      paint();
    }

    function flip() {
      flipped = !flipped;
      paint();
      save();
    }

    root.append(
      h(
        'div',
        { class: 'game' },
        h(
          'div',
          { class: 'game-bar' },
          h('div', { class: 'bar-group' }, modeControl, levelControl),
          h(
            'div',
            { class: 'bar-group' },
            btn('حرکت قبل', { variant: 'soft', onClick: undo }),
            btn('چرخش صفحه', { variant: 'soft', onClick: flip }),
            btn('بازی جدید', { variant: 'ghost', onClick: newGame }),
          ),
        ),
        h(
          'div',
          { class: 'game-body chess-layout' },
          h('div', { class: 'chess-main' }, statusEl, h('div', { class: 'chess-board-wrap' }, boardEl)),
          h(
            'div',
            { class: 'chess-side' },
            capturedEl,
            h('div', { class: 'panel chess-moves-panel' }, h('div', { class: 'panel-title', text: 'حرکات' }), movesEl),
            h(
              'div',
              { class: 'panel chess-legend' },
              h('div', { class: 'panel-title', text: 'راهنمای صفحه' }),
              h('div', { class: 'legend-row' }, h('span', { class: 'legend-swatch is-target' }), 'حرکت مجاز'),
              h('div', { class: 'legend-row' }, h('span', { class: 'legend-swatch is-capture' }), 'گرفتن مهره'),
              h('div', { class: 'legend-row' }, h('span', { class: 'legend-swatch is-check' }), 'شاه در کیش'),
            ),
          ),
        ),
      ),
    );

    paint();
    if (mode === 'ai' && state.turn === 'b' && !over) scheduleAi();

    return () => {
      if (timer) clearTimeout(timer);
    };
  },
};
