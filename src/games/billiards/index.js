import { h, btn, segmented, openModal, toast } from '../../core/ui.js';
import { faNum } from '../../core/i18n.js';
import { play } from '../../core/sound.js';
import { TABLE, POCKETS, createGame, shoot, step, isMoving, respotCue, remainingObjects } from './engine.js';

const LEVELS = { easy: { count: 5 }, medium: { count: 7 }, hard: { count: 9 } };

export default {
  id: 'billiards',
  title: 'بیلیارد',
  subtitle: 'توپ‌ها را در جیب بینداز',
  meta: 'یک یا دو نفره',
  keywords: ['بیلیارد', 'توپ', 'میز', 'جیب'],
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="6" width="18" height="12" rx="2.5"/><circle cx="8" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="16" cy="12" r="1.6"/><circle cx="4.6" cy="7.6" r="1.1" fill="currentColor"/><circle cx="19.4" cy="16.4" r="1.1" fill="currentColor"/></svg>',
  mount(root, ctx) {
    let level = 'medium';
    let players = 1;
    let state = createGame({ count: LEVELS[level].count });
    let turn = 0;
    let scores = [0, 0];
    let running = false;
    let shotPotted = [];
    let aim = null;
    let animating = false;

    const statusEl = h('div', { class: 'game-status', role: 'status' });
    const canvas = h('canvas', { class: 'billiard-canvas', 'aria-label': 'میز بیلیارد', tabindex: '0', role: 'application' });
    const scoreEl = h('div', { class: 'scores' });
    const powerFill = h('div', { class: 'power-fill', style: { width: '0%' } });
    let cctx = null;

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

    const playersControl = segmented(
      [
        { value: 1, label: 'یک نفره' },
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

    function reset() {
      state = createGame({ count: LEVELS[level].count });
      turn = 0;
      scores = [0, 0];
      running = false;
      shotPotted = [];
      aim = null;
      animating = false;
      powerFill.style.width = '0%';
      draw();
      updateStatus();
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(320, rect.width || 900);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round((width / 2) * dpr);
      cctx = canvas.getContext('2d');
      cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function toTable(event) {
      const rect = canvas.getBoundingClientRect();
      const scale = TABLE.w / (rect.width || TABLE.w);
      return { x: (event.clientX - rect.left) * scale, y: (event.clientY - rect.top) * scale, px: event.clientX - rect.left, py: event.clientY - rect.top };
    }

    function draw() {
      if (!cctx) return;
      const rect = canvas.getBoundingClientRect();
      const cssW = Math.max(320, rect.width || 900);
      const scale = cssW / TABLE.w;
      const W = TABLE.w * scale;
      const H = TABLE.h * scale;
      const r = TABLE.ballR * scale;

      cctx.clearRect(0, 0, W, H);
      const rail = cctx.createLinearGradient(0, 0, 0, H);
      rail.addColorStop(0, '#8a5b33');
      rail.addColorStop(0.5, '#5b3a1c');
      rail.addColorStop(1, '#3a2210');
      cctx.fillStyle = rail;
      cctx.fillRect(0, 0, W, H);

      const felt = cctx.createRadialGradient(W * 0.42, H * 0.32, 12, W * 0.5, H * 0.5, W * 0.72);
      felt.addColorStop(0, '#23835f');
      felt.addColorStop(0.55, '#0f5b45');
      felt.addColorStop(1, '#07382b');
      cctx.fillStyle = felt;
      cctx.fillRect(TABLE.cushion * scale, TABLE.cushion * scale, (TABLE.w - TABLE.cushion * 2) * scale, (TABLE.h - TABLE.cushion * 2) * scale);

      cctx.strokeStyle = 'rgba(0,0,0,0.35)';
      cctx.lineWidth = Math.max(1, 3 * scale);
      cctx.strokeRect(TABLE.cushion * scale, TABLE.cushion * scale, (TABLE.w - TABLE.cushion * 2) * scale, (TABLE.h - TABLE.cushion * 2) * scale);

      for (const pocket of POCKETS) {
        cctx.beginPath();
        cctx.fillStyle = '#c9a86a';
        cctx.arc(pocket.x * scale, pocket.y * scale, (TABLE.pocketR + 3) * scale, 0, Math.PI * 2);
        cctx.fill();
        cctx.beginPath();
        cctx.fillStyle = '#0a1410';
        cctx.arc(pocket.x * scale, pocket.y * scale, TABLE.pocketR * scale, 0, Math.PI * 2);
        cctx.fill();
      }

      for (const item of state.balls) {
        if (item.potted) continue;
        const bx = item.x * scale;
        const by = item.y * scale;
        cctx.beginPath();
        cctx.fillStyle = 'rgba(0,0,0,0.28)';
        cctx.ellipse(bx + r * 0.18, by + r * 0.35, r * 0.98, r * 0.85, 0, 0, Math.PI * 2);
        cctx.fill();
        cctx.beginPath();
        cctx.fillStyle = item.color;
        cctx.arc(bx, by, r, 0, Math.PI * 2);
        cctx.fill();
        const shine = cctx.createRadialGradient(bx - r * 0.35, by - r * 0.4, r * 0.1, bx, by, r);
        shine.addColorStop(0, 'rgba(255,255,255,0.72)');
        shine.addColorStop(0.35, 'rgba(255,255,255,0.12)');
        shine.addColorStop(1, 'rgba(0,0,0,0.28)');
        cctx.beginPath();
        cctx.fillStyle = shine;
        cctx.arc(bx, by, r, 0, Math.PI * 2);
        cctx.fill();
        cctx.lineWidth = Math.max(1, 1.2 * scale);
        cctx.strokeStyle = 'rgba(0,0,0,0.3)';
        cctx.stroke();
      }

      if (aim && !running) {
        const cue = state.balls.find((item) => item.id === 'cue');
        if (cue && !cue.potted) {
          cctx.beginPath();
          cctx.strokeStyle = 'rgba(255,255,255,0.7)';
          cctx.setLineDash([6 * scale, 5 * scale]);
          cctx.lineWidth = Math.max(1, 1.4 * scale);
          cctx.moveTo(cue.x * scale, cue.y * scale);
          cctx.lineTo((cue.x + Math.cos(aim.angle) * 190) * scale, (cue.y + Math.sin(aim.angle) * 190) * scale);
          cctx.stroke();
          cctx.setLineDash([]);
        }
      }
    }

    function updateStatus() {
      const who = players === 2 ? `بازیکن ${faNum(turn + 1)}` : 'تو';
      if (!running && remainingObjects(state) > 0) {
        statusEl.innerHTML = `نوبت <strong>${who}</strong> — روی میز بکش و رها کن.`;
      }
      const seats = players === 2 ? [0, 1] : [0];
      scoreEl.replaceChildren(
        ...seats.map((i) =>
          h(
            'div',
            { class: `score ${players === 2 && turn === i && !running ? 'is-turn' : ''}`.trim() },
            h('span', { class: 'score-label' }, h('span', { class: `dot dot-${i + 1}` }), players === 2 ? `بازیکن ${faNum(i + 1)}` : 'تو'),
            h('span', { class: 'score-value', text: faNum(scores[i]) }),
          ),
        ),
      );
    }

    let keyAngle = 0;
    let keyPower = 0.55;

    function keyboardShot() {
      if (running || animating) return;
      const cue = state.balls.find((item) => item.id === 'cue');
      if (!cue || cue.potted) return;
      state = shoot(state, keyAngle, keyPower);
      shotPotted = [];
      play('cue');
      running = true;
      updateStatus();
      requestAnimationFrame(loop);
    }

    function onKey(event) {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(event.key)) return;
      if (document.querySelector('.modal-backdrop')) return;
      event.preventDefault();
      if (event.key === 'ArrowLeft') keyAngle -= Math.PI / 36;
      else if (event.key === 'ArrowRight') keyAngle += Math.PI / 36;
      else if (event.key === 'ArrowUp') keyPower = Math.min(1, keyPower + 0.05);
      else if (event.key === 'ArrowDown') keyPower = Math.max(0.12, keyPower - 0.05);
      else {
        keyboardShot();
        return;
      }
      powerFill.style.width = `${Math.round(keyPower * 100)}%`;
      const cue = state.balls.find((item) => item.id === 'cue');
      if (cue && !cue.potted) {
        aim = { angle: keyAngle, point: { x: cue.x, y: cue.y } };
        draw();
      }
    }
    canvas.addEventListener('keydown', onKey);

    function onDown(event) {
      if (running || animating) return;
      const cue = state.balls.find((item) => item.id === 'cue');
      if (!cue || cue.potted) return;
      const point = toTable(event);
      aim = { angle: Math.atan2(point.y - cue.y, point.x - cue.x), point };
      canvas.setPointerCapture?.(event.pointerId);
      draw();
    }

    function onMove(event) {
      if (!aim || running) return;
      const point = toTable(event);
      const cue = state.balls.find((item) => item.id === 'cue');
      if (!cue) return;
      aim = { angle: Math.atan2(point.y - cue.y, point.x - cue.x), point };
      const power = Math.min(1, Math.max(0.08, Math.hypot(point.x - cue.x, point.y - cue.y) / 320));
      powerFill.style.width = `${Math.round(power * 100)}%`;
      draw();
    }

    function onUp(event) {
      if (!aim || running) return;
      const cue = state.balls.find((item) => item.id === 'cue');
      if (!cue) return;
      const point = toTable(event);
      const power = Math.min(1, Math.max(0.12, Math.hypot(point.x - cue.x, point.y - cue.y) / 320));
      aim = null;
      powerFill.style.width = '0%';
      if (power < 0.12) return;
      state = shoot(state, Math.atan2(point.y - cue.y, point.x - cue.x), power);
      shotPotted = [];
      play('cue');
      running = true;
      play('click');
      updateStatus();
      requestAnimationFrame(loop);
    }

    function loop() {
      if (!running) return;
      const res = step(state);
      state = res.state;
      if (res.lastPotted.length) shotPotted.push(...res.lastPotted);
      draw();
      if (isMoving(state)) {
        requestAnimationFrame(loop);
      } else {
        running = false;
        endShot();
      }
    }

    function endShot() {
      const cuePotted = shotPotted.includes('cue');
      const objects = shotPotted.filter((id) => id !== 'cue');
      if (cuePotted) {
        state = respotCue(state);
        play('wrong');
        toast('توپ سفید افتاد؛ نوبت عوض شد');
        if (players === 2) turn = 1 - turn;
      } else if (objects.length) {
        play('pot');
        scores[turn] += objects.length;
        if (objects.length > 1) {
          scores[turn] += 0;
        }
      } else if (players === 2) {
        turn = 1 - turn;
      }
      draw();
      updateStatus();
      if (remainingObjects(state) === 0) {
        finish();
      }
    }

    function finish() {
      const winner = players === 2 ? (scores[0] === scores[1] ? -1 : scores[0] > scores[1] ? 0 : 1) : 0;
      if (players === 1) {
        ctx.record('win');
        ctx.record(state.shots);
        play('win');
      } else if (winner === 0) {
        ctx.record('win');
        play('win');
      } else if (winner === 1) {
        ctx.record('loss');
        play('lose');
      } else {
        ctx.record('draw');
      }
      openModal({
        title: players === 1 ? 'میز تمیز شد' : winner === 0 ? 'بازیکن ۱ برد' : winner === 1 ? 'بازیکن ۲ برد' : 'مساوی',
        body: h('p', { text: `ضربه‌ها: ${faNum(state.shots)} — امتیازها: ${faNum(scores[0])} و ${faNum(scores[1])}` }),
        actions: [
          { label: 'دوباره', variant: 'primary', onClick: reset },
          { label: 'بستن', variant: 'ghost' },
        ],
      });
    }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    window.addEventListener('resize', resize);

    root.append(
      h(
        'div',
        { class: 'game' },
        h(
          'div',
          { class: 'game-bar' },
          h('div', { class: 'bar-group' }, levelControl, playersControl),
          h('div', { class: 'bar-group' }, btn('میز جدید', { variant: 'ghost', onClick: reset })),
        ),
        statusEl,
        h('div', { class: 'game-body' }, h('div', { class: 'billiard-wrap' }, canvas)),
        h('div', { class: 'power-bar' }, powerFill),
        h('div', { class: 'billiard-keys row small' }, btn('چرخش نشانه ◀', { variant: 'soft', className: 'btn-sm', onClick: () => onKey({ key: 'ArrowLeft', preventDefault() {} }) }), btn('چرخش نشانه ▶', { variant: 'soft', className: 'btn-sm', onClick: () => onKey({ key: 'ArrowRight', preventDefault() {} }) }), btn('شلیک', { variant: 'primary', className: 'btn-sm', onClick: keyboardShot })),
        scoreEl,
        h('p', { class: 'small faint center', text: 'روی میز بکش و رها کن: جهت و قدرت ضربه را تعیین می‌کند. اگر توپی بیندازی، نوبتت ادامه دارد.' }),
      ),
    );

    powerFill.style.width = '0%';
    requestAnimationFrame(resize);

    return () => {
      running = false;
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('keydown', onKey);
    };
  },
};
