import { h, btn, segmented, openModal, toast } from '../../core/ui.js';
import { faNum } from '../../core/i18n.js';
import { play } from '../../core/sound.js';
import { cardEl, cardBack } from '../../core/cards.js';
import { createGame, startRound, changeBet, hit, stand, double, dealerTurn, nextRound, handValue, payoutLabel } from './engine.js';

export default {
  id: 'blackjack',
  title: 'بیست و یک',
  subtitle: 'به ۲۱ نزدیک شو، ولی رد نشو',
  meta: '۱ تا ۴ نفر روی یک دستگاه',
  keywords: ['بیست و یک', 'بلک‌جک', 'کارت'],
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="4" y="7" width="9" height="13" rx="2"/><rect x="9" y="4" width="9" height="13" rx="2"/><path d="M13.5 8v5M11 10.5h5"/></svg>',
  mount(root, ctx) {
    let players = 1;
    let level = 'normal';
    let game = createGame({ players, level });
    let timer = null;
    let busy = false;

    const statusEl = h('div', { class: 'game-status', role: 'status' });

    const playersControl = segmented(
      [1, 2, 3, 4].map((n) => ({ value: n, label: `${faNum(n)} نفر` })),
      {
        value: players,
        label: 'تعداد بازیکن',
        onChange: (v) => {
          players = v;
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
        label: 'سطح دلال',
        onChange: (v) => {
          level = v;
          game = { ...game, level };
          render();
        },
      },
    );

    function restart() {
      if (timer) clearTimeout(timer);
      timer = null;
      busy = false;
      game = createGame({ players, level });
      render();
    }

    function scheduleDealer() {
      if (game.phase !== 'dealer' || busy) return;
      busy = true;
      render();
      timer = setTimeout(() => {
        timer = null;
        busy = false;
        game = dealerTurn(game);
        play('place');
        render();
      }, 700);
    }

    function render() {
      const revealDealer = game.phase === 'settle' || game.phase === 'dealer';
      const dealerHand = game.dealer.hand;
      const visibleDealer = revealDealer ? dealerHand : dealerHand.slice(0, 1);
      const dealerValue = handValue(visibleDealer).total;

      const playersEl = h(
        'div',
        { class: 'bj-players' },
        ...game.players.map((player, i) => playerBlock(player, i)),
      );

      root.replaceChildren(
        h(
          'div',
          { class: 'game' },
          h('div', { class: 'game-bar' }, h('div', { class: 'bar-group' }, playersControl, levelControl), h('div', { class: 'bar-group' }, btn('بازی جدید', { variant: 'ghost', onClick: restart }))),
          statusEl,
          h(
            'div',
            { class: 'game-body bj-table' },
            h(
              'div',
              { class: 'bj-dealer' },
              h('div', { class: 'bj-label small muted', text: `دلال${game.phase !== 'bet' ? ` — ${faNum(dealerValue)}` : ''}` }),
              h(
                'div',
                { class: 'bj-hand' },
                ...dealerHand.map((card, i) =>
                  i === 1 && !revealDealer ? cardBack() : cardEl(card, { small: true }),
                ),
                dealerHand.length ? null : h('span', { class: 'small faint', text: 'منتظر شروع دست' }),
              ),
            ),
            playersEl,
            controls(),
          ),
        ),
      );

      updateStatus();
    }

    function controls() {
      if (game.phase === 'bet') {
        return h('div', { class: 'bj-controls' }, btn('شروع دست', { variant: 'primary', onClick: deal }));
      }
      if (game.phase === 'play') {
        const player = game.players[game.active];
        const canDouble = player && player.hand.length === 2 && player.chips >= player.bet;
        return h(
          'div',
          { class: 'bj-controls' },
          h('span', { class: 'chip chip-accent', text: `نوبت ${player ? player.name : ''}` }),
          btn('برگ', { variant: 'primary', onClick: () => { game = hit(game); play('card'); render(); scheduleDealer(); } }),
          btn('نگه‌دار', { variant: 'soft', onClick: () => { game = stand(game); render(); scheduleDealer(); } }),
          canDouble ? btn('دابل', { variant: 'soft', onClick: () => { game = double(game); play('card'); render(); scheduleDealer(); } }) : null,
        );
      }
      if (game.phase === 'dealer') {
        return h('div', { class: 'bj-controls' }, h('span', { class: 'chip', text: 'دلال دارد بازی می‌کند…' }));
      }
      return h(
        'div',
        { class: 'bj-controls' },
        btn('دست بعد', { variant: 'primary', onClick: () => { game = nextRound(game); render(); } }),
        btn('بازی جدید', { variant: 'soft', onClick: restart }),
      );
    }

    function playerBlock(player, index) {
      const active = game.phase === 'play' && game.active === index;
      const value = handValue(player.hand).total;
      return h(
        'div',
        { class: `bj-player ${active ? 'is-active' : ''}`.trim() },
        h(
          'div',
          { class: 'bj-player-head' },
          h('span', { class: 'bj-name', text: player.name }),
          h('span', { class: 'chip', text: `سکه: ${faNum(player.chips)}` }),
          h('span', { class: 'chip', text: `شرط: ${faNum(player.bet)}` }),
          player.hand.length ? h('span', { class: `chip ${value > 21 ? 'chip-danger' : 'chip-accent'}`.trim(), text: `دست: ${faNum(value)}` }) : null,
        ),
        h('div', { class: 'bj-hand' }, ...player.hand.map((card) => cardEl(card, { small: true }))),
        h('div', { class: 'bj-player-foot' }, playerFoot(player, index)),
      );
    }

    function playerFoot(player, index) {
      if (game.phase === 'bet') {
        return h(
          'div',
          { class: 'row' },
          btn('−', { variant: 'soft', className: 'btn-sm', onClick: () => { game = changeBet(game, index, -5); play('chip'); render(); } }),
          h('span', { class: 'small muted', text: `شرط: ${faNum(player.bet)}` }),
          btn('+', { variant: 'soft', className: 'btn-sm', onClick: () => { game = changeBet(game, index, 5); play('chip'); render(); } }),
        );
      }
      if (!player.result) return null;
      const good = player.result === 'win' || player.result === 'blackjack';
      return h(
        'div',
        { class: 'row' },
        h('span', { class: `chip ${good ? 'chip-accent' : player.result === 'push' ? '' : 'chip-danger'}`.trim(), text: payoutLabel(player.result) }),
        h('span', { class: 'small muted', text: `${player.delta > 0 ? '+' : ''}${faNum(player.delta)}` }),
      );
    }

    function updateStatus() {
      if (game.phase === 'bet') {
        statusEl.textContent = 'شرط‌ها را تعیین کن و دست را شروع کن.';
        return;
      }
      if (game.phase === 'play') {
        const player = game.players[game.active];
        statusEl.innerHTML = `نوبت <strong>${player ? player.name : ''}</strong> — یک برگ بگیر یا نگه‌دار.`;
        return;
      }
      if (game.phase === 'dealer') {
        statusEl.textContent = 'دلال دارد برگ می‌گیرد…';
        return;
      }
      statusEl.textContent = 'نتیجه‌ی دست مشخص شد.';
    }

    function deal() {
      const anyBet = game.players.some((player) => player.bet > 0 && player.chips > 0);
      if (!anyBet) {
        toast('سکه‌ای برای شرط‌بندی نداری');
        return;
      }
      game = startRound(game);
      play('card');
      render();
      scheduleDealer();
    }

    root.append(h('div'));
    render();

    return () => {
      if (timer) clearTimeout(timer);
    };
  },
};
