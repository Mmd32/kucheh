import { h, btn, segmented, openModal, toast } from '../../core/ui.js';
import { faNum } from '../../core/i18n.js';
import { play } from '../../core/sound.js';
import {
  SIZE,
  FLEET,
  FLEETS,
  emptyBoard,
  cellsFor,
  canPlace,
  randomBoard,
  shipAt,
  allSunk,
  fireAt,
  createAi,
  aiNextShot,
  aiRecord,
} from './engine.js';

const ROWS = 'ABCDEFGHIJ'.split('');

export default {
  id: 'battleship',
  title: 'نبرد دریایی',
  subtitle: 'ناوها را پیدا کن و غرق کن',
  meta: 'دو نفره یا کامپیوتر',
  keywords: ['نبرد', 'دریا', 'کشتی'],
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 15.5l2-4h13l2 4"/><path d="M5 15.5v4h14v-4"/><path d="M9 11.5V7h6v4.5"/><path d="M12 7V3.5M12 20v-3"/></svg>',
  mount(root, ctx) {
    const saved = ctx.load();
    let level = 'medium';
    let fleet = FLEETS[level];
    let phase = 'setup';
    let myBoard = emptyBoard();
    let enemyBoard = emptyBoard();
    let slots = FLEETS[level].map((size) => ({ size, placed: false }));
    let direction = 'h';
    let turn = 'me';
    let ai = createAi();
    let aiTimer = null;
    let over = false;

    if (saved && saved.phase === 'play' && saved.my && saved.enemy) {
      try {
        phase = 'play';
        myBoard = saved.my;
        enemyBoard = saved.enemy;
        turn = saved.turn === 'ai' ? 'ai' : 'me';
        slots = fleet.map((size) => ({ size, placed: true }));
        ai = { shots: new Set(saved.ai?.shots || []), queue: [...(saved.ai?.queue || [])], blocked: new Set(saved.ai?.blocked || []) };
        toast('ادامه‌ی بازی قبلی');
      } catch (err) {
        phase = 'setup';
      }
    }

    const statusEl = h('div', { class: 'game-status', role: 'status' });
    const gridsEl = h('div', { class: 'bs-grids' });
    const setupBar = h('div', { class: 'bs-setup' });
    const fleetEl = h('div', { class: 'row small' });
    const rotateBtn = btn('جهت: افقی', { variant: 'soft', onClick: () => { direction = direction === 'h' ? 'v' : 'h'; rotateBtn.textContent = direction === 'h' ? 'جهت: افقی' : 'جهت: عمودی'; render(); } });
    const startBtn = btn('شروع نبرد', { variant: 'primary', onClick: startBattle });
    const randomBtn = btn('چیدن تصادفی', { variant: 'soft', onClick: () => { myBoard = randomBoard(); slots = slots.map((s) => ({ ...s, placed: true })); render(); } });
    const clearBtn = btn('پاک‌کردن چیدمان', { variant: 'soft', onClick: clearPlacements });

    function activeSlot() {
      return slots.find((s) => !s.placed) || null;
    }

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
          fleet = FLEETS[level];
          reset();
        },
      },
    );

    function save() {
      if (phase !== 'play' || over) return;
      ctx.save({
        phase: 'play',
        my: myBoard,
        enemy: enemyBoard,
        turn,
        ai: { shots: [...ai.shots], queue: ai.queue, blocked: [...ai.blocked] },
      });
    }

    function render() {
      gridsEl.replaceChildren(renderGrid('player'), renderGrid('enemy'));
      renderSetup();
      renderStatus();
      renderFleet();
      renderButtons();
    }

    function renderButtons() {
      startBtn.classList.toggle('hidden', phase !== 'setup');
      randomBtn.classList.toggle('hidden', phase !== 'setup');
      rotateBtn.classList.toggle('hidden', phase !== 'setup');
      clearBtn.classList.toggle('hidden', phase !== 'setup');
      startBtn.disabled = phase === 'setup' && Boolean(activeSlot());
      levelControl.classList.toggle('hidden', phase !== 'setup');
    }

    function clearPlacements() {
      if (phase !== 'setup') return;
      myBoard = emptyBoard();
      slots = fleet.map((size) => ({ size, placed: false }));
      play('click');
      render();
    }

    function aliveCount(board) {
      return board.ships.filter((ship) => ship.hits.length < ship.size).length;
    }

    function renderFleet() {
      if (phase === 'setup') {
        fleetEl.replaceChildren();
        fleetEl.classList.add('hidden');
        return;
      }
      fleetEl.classList.remove('hidden');
      fleetEl.replaceChildren(
        h('span', { class: 'chip chip-accent', text: `ناوهای تو: ${faNum(aliveCount(myBoard))}` }),
        h('span', { class: 'chip chip-danger', text: `ناوهای دشمن: ${faNum(aliveCount(enemyBoard))}` }),
      );
    }

    function renderSetup() {
      setupBar.replaceChildren(
        ...slots.map((slot) =>
          h(
            'span',
            { class: `chip ${slot.placed ? 'chip-accent' : ''}`.trim(), text: `${faNum(slot.size)} خانه${slot.placed ? ' ✓' : ''}` },
          ),
        ),
      );
    }

    function renderStatus() {
      if (phase === 'setup') {
        const slot = activeSlot();
        statusEl.textContent = slot
          ? `ناو ${faNum(slot.size)} خانه‌ای را روی دریای خودت بگذار.`
          : 'همه‌ی ناوها چیده شد؛ نبرد را شروع کن.';
        return;
      }
      if (over) return;
      if (turn === 'me') statusEl.innerHTML = 'نوبت تو — روی دریای دشمن شلیک کن.';
      else statusEl.textContent = 'کامپیوتر دارد شلیک می‌کند…';
    }

    function renderGrid(which) {
      const isPlayer = which === 'player';
      const board = isPlayer ? myBoard : enemyBoard;
      const grid = h('div', { class: 'bs-grid', role: 'grid', 'aria-label': isPlayer ? 'دریای تو' : 'دریای دشمن' });
      for (let i = 0; i < SIZE * SIZE; i++) {
        const shot = board.shots[i];
        const ship = isPlayer ? shipAt(board, i) : null;
        const cls = ['bs-cell'];
        if (shot === 'hit') cls.push('is-hit');
        else if (shot === 'miss') cls.push('is-miss');
        if (isPlayer && ship) cls.push('is-ship');
        if (phase === 'over' && !isPlayer && ship) cls.push('is-ship');

        const r = Math.floor(i / SIZE);
        const c = i % SIZE;
        const label = `${ROWS[r]}${faNum(c + 1)}`;
        const cell = h('button', {
          type: 'button',
          class: cls.join(' '),
          role: 'gridcell',
          'aria-label': `${label}${shot === 'hit' ? '، اصابت' : shot === 'miss' ? '، خطا' : '، شلیک‌نشده'}`,
          onClick: () => {
            if (phase === 'setup' && isPlayer) placeAt(i);
            else if (phase === 'play' && !isPlayer) playerFire(i);
          },
        });
        if (shot === 'hit') cell.append(h('span', { class: 'bs-mark', text: '✕' }));
        else if (shot === 'miss') cell.append(h('span', { class: 'bs-mark', text: '•' }));
        else if (isPlayer && ship) cell.append(h('span', { class: 'bs-ship-dot' }));
        grid.append(cell);
      }
      return h(
        'div',
        { class: `bs-side ${isPlayer ? 'bs-side-player' : 'bs-side-enemy'}` },
        h('div', { class: 'bs-side-title small muted', text: isPlayer ? 'دریای تو' : 'دریای دشمن' }),
        grid,
        isPlayer && phase === 'setup' ? h('div', { class: 'bs-side-hint small faint', text: 'ناوها را روی خانه‌ها بچین یا «چیدن تصادفی» را بزن.' }) : null,
      );
    }

    function placeAt(index) {
      const slot = activeSlot();
      if (!slot) return;
      const row = Math.floor(index / SIZE);
      const col = index % SIZE;
      const cells = cellsFor(row, col, slot.size, direction);
      if (!canPlace(myBoard, cells)) {
        toast('این‌جا جا نمی‌شود؛ جای دیگری را امتحان کن.');
        play('wrong');
        return;
      }
      myBoard = { ...myBoard, ships: [...myBoard.ships, { size: slot.size, cells, hits: [] }] };
      slot.placed = true;
      play('place');
      render();
    }

    function startBattle() {
      if (activeSlot()) {
        toast('اول همه‌ی ناوها را بچین');
        return;
      }
      phase = 'play';
      enemyBoard = randomBoard(Math.random, fleet);
      turn = 'me';
      play('correct');
      render();
      save();
    }

    function playerFire(index) {
      if (phase !== 'play' || over || turn !== 'me') return;
      const res = fireAt(enemyBoard, index);
      if (res.result === 'repeat') return;
      enemyBoard = res.target;
      play(res.result === 'miss' ? 'move' : 'capture');
      if (res.result === 'sunk') toast('ناو غرق شد!');
      if (allSunk(enemyBoard)) {
        finish(true);
        return;
      }
      turn = 'ai';
      render();
      save();
      aiTimer = setTimeout(aiTurn, 650);
    }

    function aiTurn() {
      aiTimer = null;
      if (over || phase !== 'play') return;
      const index = aiNextShot(ai);
      if (index == null) return;
      const res = fireAt(myBoard, index);
      myBoard = res.target;
      aiRecord(ai, index, res.result, res.ship);
      if (res.result === 'sunk') toast('کامپیوتر یکی از ناوهایت را غرق کرد');
      if (allSunk(myBoard)) {
        finish(false);
        return;
      }
      turn = 'me';
      play(res.result === 'miss' ? 'move' : 'capture');
      render();
      save();
    }

    function finish(won) {
      over = true;
      phase = 'over';
      if (aiTimer) clearTimeout(aiTimer);
      aiTimer = null;
      ctx.clearSave();
      ctx.record(won ? 'win' : 'loss');
      play(won ? 'win' : 'lose');
      render();
      statusEl.textContent = won ? 'همه‌ی ناوهای دشمن غرق شد.' : 'همه‌ی ناوهای تو غرق شد.';
      openModal({
        title: won ? 'بردی' : 'باختی',
        body: h('p', { text: won ? 'دریای دشمن پاک شد.' : 'دشمن دریای تو را پاک کرد.' }),
        actions: [
          { label: 'بازی جدید', variant: 'primary', onClick: reset },
          { label: 'بستن', variant: 'ghost' },
        ],
      });
    }

    function reset() {
      if (aiTimer) clearTimeout(aiTimer);
      aiTimer = null;
      phase = 'setup';
      myBoard = emptyBoard();
      enemyBoard = emptyBoard();
      slots = fleet.map((size) => ({ size, placed: false }));
      turn = 'me';
      ai = createAi();
      over = false;
      ctx.clearSave();
      render();
    }

    root.append(
      h(
        'div',
        { class: 'game' },
        h('div', { class: 'game-bar' }, h('div', { class: 'bar-group' }, levelControl, setupBar), h('div', { class: 'bar-group' }, rotateBtn, randomBtn, clearBtn, startBtn, btn('شروع دوباره', { variant: 'ghost', onClick: reset }))),
        statusEl,
        fleetEl,
        h('div', { class: 'game-body' }, gridsEl),
      ),
    );

    render();
    if (phase === 'play' && turn === 'ai') aiTimer = setTimeout(aiTurn, 700);

    return () => {
      if (aiTimer) clearTimeout(aiTimer);
    };
  },
};
