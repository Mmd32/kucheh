import { h, btn, segmented, openModal } from '../../core/ui.js';
import { faNum } from '../../core/i18n.js';
import { play } from '../../core/sound.js';
import { cardEl, cardBack } from '../../core/cards.js';
import { createGame, playCard, nextRound, aiPlay } from './engine.js';

export default {
  id: 'chaharbarg',
  title: 'چهار برگ',
  subtitle: 'با برگ هم‌رتبه، از بازار بگیر',
  meta: '۱ تا ۴ نفر روی یک دستگاه',
  keywords: ['چهار برگ', 'کارت', 'بازی ایرانی'],
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="7.5" y="3.5" width="9" height="12" rx="1.6"/><path d="M5.2 7.2v10.6a2 2 0 002 2h7.6"/><path d="M12 7.5l1.2 2.4 2.4.4-1.8 1.7.4 2.4-2.2-1.2-2.2 1.2.4-2.4-1.8-1.7 2.4-.4z"/></svg>',
  mount(root, ctx) {
    let humans = 1;
    let level = 'normal';
    let game = createGame({ humans, level });
    let busy = false;
    let timer = null;

    const statusEl = h('div', { class: 'game-status', role: 'status' });

    const humansControl = segmented(
      [1, 2, 3, 4].map((n) => ({ value: n, label: `${faNum(n)} نفر` })),
      {
        value: humans,
        label: 'بازیکن‌های انسانی',
        onChange: (v) => {
          humans = v;
          restart();
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
        label: 'سطح کامپیوتر',
        onChange: (v) => {
          level = v;
          game = { ...game, level };
          render();
        },
      },
    );

    function isHuman(seat) {
      return game.seats[seat].kind === 'human';
    }

    function restart() {
      if (timer) clearTimeout(timer);
      timer = null;
      busy = false;
      game = createGame({ humans, level });
      render();
      scheduleAi();
    }

    function render() {
      const rows = game.seats.map((_, index) => seatRow(index));
      const handEl = rows[game.turn];
      const opponents = rows.filter((_, index) => index !== game.turn);
      const marketEl = h(
        'div',
        { class: 'cb-market' },
        h('div', { class: 'cb-market-title small muted', text: 'بازار' }),
        h(
          'div',
          { class: 'cb-market-cards' },
          ...game.market.map((card) => h('div', { class: 'cb-market-card' }, cardEl(card, { small: true }))),
        ),
      );

      const table = h('div', { class: 'cb-table' }, h('div', { class: 'cb-opponents' }, ...opponents), marketEl, handEl);

      root.replaceChildren(
        h(
          'div',
          { class: 'game' },
          h('div', { class: 'game-bar' }, h('div', { class: 'bar-group' }, humansControl, levelControl), h('div', { class: 'bar-group' }, btn('بازی جدید', { variant: 'ghost', onClick: restart }))),
          statusEl,
          h('div', { class: 'game-body' }, table),
        ),
      );

      updateStatus();
    }

    function seatRow(seat, big = false) {
      const active = game.phase === 'play' && game.turn === seat;
      const hand = game.hands[seat] || [];
      const captured = game.piles[seat].length;
      const humanCount = game.seats.filter((item) => item.kind === 'human').length;
      const visible = humanCount === 1 ? game.seats[seat].kind === 'human' : seat === game.turn && isHuman(seat);
      const canPlay = active && isHuman(seat) && !busy;
      return h(
        'div',
        { class: `cb-seat ${active ? 'is-active' : ''} ${big ? 'is-big' : ''}`.trim() },
        h(
          'div',
          { class: 'cb-name' },
          h('span', { text: game.seats[seat].name }),
          h('span', { class: 'chip', text: `گرفته: ${faNum(captured)}` }),
          active ? h('span', { class: 'chip chip-accent', text: 'نوبت' }) : null,
        ),
        h(
          'div',
          { class: `cb-hand ${visible ? '' : 'is-back'}`.trim() },
          visible
            ? hand.map((card) =>
                cardEl(card, {
                  small: !big,
                  disabled: !canPlay,
                  onClick: canPlay ? () => onPlay(seat, card.id) : null,
                }),
              )
            : [
                ...hand.slice(0, 5).map(() => cardBack(!big)),
                h('span', { class: 'chip' }, `${faNum(hand.length)} برگ`),
              ],
          hand.length || !visible ? null : h('span', { class: 'small faint', text: 'دست خالی' }),
        ),
      );
    }

    function updateStatus() {
      if (game.phase !== 'play') return;
      const seat = game.turn;
      const marketRanks = new Set(game.market.map((card) => card.rank));
      const options = (game.hands[seat] || []).filter((card) => marketRanks.has(card.rank)).length;
      statusEl.innerHTML = `نوبت <strong>${game.seats[seat].name}</strong> — ${faNum(options)} برگ برای گرفتن از بازار داری.`;
    }

    function onPlay(seat, cardId) {
      if (game.phase !== 'play' || game.turn !== seat || busy) return;
      if (!isHuman(seat)) return;
      game = playCard(game, seat, cardId);
      play('card');
      afterMove();
    }

    function afterMove() {
      render();
      if (game.phase === 'end') {
        finishRound();
        return;
      }
      scheduleAi();
    }

    function scheduleAi() {
      if (timer) clearTimeout(timer);
      timer = null;
      if (game.phase !== 'play') return;
      const seat = game.turn;
      if (isHuman(seat)) return;
      busy = true;
      timer = setTimeout(() => {
        busy = false;
        const card = aiPlay(game, seat);
        if (!card) return;
        game = playCard(game, seat, card.id);
        play('place');
        afterMove();
      }, 650);
    }

    function finishRound() {
      if (timer) clearTimeout(timer);
      timer = null;
      const humanSeats = game.seats.map((seat, i) => (seat.kind === 'human' ? i : -1)).filter((i) => i >= 0);
      const best = Math.max(...game.totals);
      const humanWon = humanSeats.some((i) => game.totals[i] === best);
      if (humanSeats.length) ctx.record(humanWon ? 'win' : 'loss');
      play(humanWon ? 'win' : 'lose');
      const last = game.round >= 3;
      openModal({
        title: humanWon ? 'این دور را بردی' : 'این دور را باختی',
        body: h(
          'div',
          { class: 'stack' },
          h(
            'ul',
            { class: 'list' },
            ...game.seats.map((seat, i) =>
              h(
                'li',
                { class: 'list-item' },
                h('span', { text: seat.name }),
                h('strong', { text: `${faNum(game.scores[i])} (جمع: ${faNum(game.totals[i])})` }),
              ),
            ),
          ),
          h('p', { class: 'small muted', text: last ? 'سه دور تمام شد.' : `دور ${faNum(game.round)} از ۳` }),
        ),
        actions: last
          ? [{ label: 'بازی جدید', variant: 'primary', onClick: restart }]
          : [
              {
                label: 'دور بعد',
                variant: 'primary',
                onClick: () => {
                  game = nextRound(game);
                  render();
                  scheduleAi();
                },
              },
            ],
      });
    }

    render();
    scheduleAi();

    return () => {
      if (timer) clearTimeout(timer);
    };
  },
};
