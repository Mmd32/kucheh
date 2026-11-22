import { h, btn, segmented, openModal, toast } from '../../core/ui.js';
import { faNum } from '../../core/i18n.js';
import { play } from '../../core/sound.js';
import { cardEl, cardBack, SUIT_INFO } from '../../core/cards.js';
import { createMatch, dealFive, chooseTrump, playCard, legalCards, startNextRound, SUITS } from './engine.js';
import { aiChooseTrump, aiPlay } from './ai.js';

export default {
  id: 'hokm',
  title: 'حکم',
  subtitle: 'چهار نفره، دو تیم، هفت دست',
  meta: '۱ تا ۴ نفر روی یک دستگاه',
  keywords: ['حکم', 'کارت', 'تیم', 'حکم'],
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3.6c2.2 2.4 4 3 5.4 2 1.4 2.6-.2 5-2.4 6.3H19v3.6H5v-3.6h4C6.8 10.6 5.2 8.2 6.6 5.6c1.4 1 3.2.4 5.4-2z"/></svg>',
  mount(root, ctx) {
    let humans = 1;
    let level = 'normal';
    let match = dealFive(createMatch({ humans, level }));
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
          match = { ...match, level };
        },
      },
    );

    function isHuman(seat) {
      return match.seats[seat].kind === 'human';
    }

    function restart() {
      if (timer) clearTimeout(timer);
      timer = null;
      busy = false;
      match = dealFive(createMatch({ humans, level }));
      render();
      scheduleAi();
    }

    function render() {
      const counts = { S: 0, H: 0, D: 0, C: 0 };
      for (const card of match.hands[match.hakem] || []) counts[card.suit] += 1;

      const trumpText = match.trump ? `${SUIT_INFO[match.trump].glyph} ${SUIT_INFO[match.trump].name}` : 'انتخاب نشده';

      const controls = h(
        'div',
        { class: 'game-bar' },
        h('div', { class: 'bar-group' }, humansControl, levelControl),
        h('div', { class: 'bar-group' }, btn('بازی جدید', { variant: 'ghost', onClick: restart })),
      );

      const scoreRow = h(
        'div',
        { class: 'row' },
        h('span', { class: 'chip chip-accent', text: `حکم: ${trumpText}` }),
        h('span', { class: 'chip', text: `دست‌ها: ${faNum(match.teamTricks[0])} — ${faNum(match.teamTricks[1])}` }),
        h('span', { class: 'chip', text: `بردها: ${faNum(match.scores[0])} — ${faNum(match.scores[1])}` }),
        h('span', { class: 'chip', text: `دور ${faNum(match.round)}` }),
      );

      const body =
        match.phase === 'trump' && isHuman(match.hakem)
          ? h(
              'div',
              { class: 'panel stack center' },
              h('h2', { class: 'party-team', text: 'حکم را انتخاب کن' }),
              h(
                'div',
                { class: 'row', style: { justifyContent: 'center' } },
                ...SUITS.map((suit) =>
                  btn(`${SUIT_INFO[suit].glyph} ${SUIT_INFO[suit].name} (${faNum(counts[suit])})`, {
                    variant: 'soft',
                    onClick: () => chooseTrumpNow(suit),
                  }),
                ),
              ),
              h('p', { class: 'small faint', text: 'حکم، خال برنده‌ی این دست است.' }),
            )
          : null;

      const table = h(
        'div',
        { class: 'hokm-table' },
        seatRow(2, 'top'),
        h('div', { class: 'hokm-middle' }, seatRow(1, 'right'), trickArea(), seatRow(3, 'left')),
        seatRow(0, 'bottom'),
      );

      root.replaceChildren(
        h(
          'div',
          { class: 'game' },
          controls,
          statusEl,
          scoreRow,
          h('div', { class: 'game-body' }, body, table),
        ),
      );

      updateStatus();
    }

    function seatRow(seat, pos) {
      const active = match.phase === 'play' && match.turn === seat;
      const cards = match.hands[seat] || [];
      const humanCount = match.seats.filter((item) => item.kind === 'human').length;
      const visible =
        humanCount === 1
          ? match.seats[seat].kind === 'human'
          : match.phase === 'trump'
            ? seat === match.hakem
            : seat === match.turn && isHuman(seat);
      const canPlay = active && isHuman(seat) && !busy;
      return h(
        'div',
        { class: `hokm-seat is-${pos} ${active ? 'is-active' : ''}`.trim() },
        h('div', { class: 'hokm-name' }, `${seat === 2 ? 'شریک · ' : ''}${match.seats[seat].name}`, active ? h('span', { class: 'chip chip-accent', text: 'نوبت' }) : null),
        h(
          'div',
          { class: `hokm-hand is-${pos} ${visible ? '' : 'is-back'}`.trim() },
          visible
            ? cards.map((card) =>
                cardEl(card, {
                  small: pos !== 'bottom',
                  disabled: !canPlay,
                  onClick: canPlay ? () => playCardNow(seat, card.id) : null,
                }),
              )
            : [
                ...cards.slice(0, 5).map(() => cardBack(pos !== 'bottom')),
                h('span', { class: 'chip' }, `${faNum(cards.length)} برگ`),
              ],
        ),
      );
    }

    function trickArea() {
      if (!match.trick.length && !match.lastTrick) {
        return h('div', { class: 'hokm-trick' }, h('span', { class: 'small muted', text: 'میان میز' }));
      }
      const list = match.trick.length ? match.trick : match.lastTrick || [];
      return h(
        'div',
        { class: 'hokm-trick' },
        ...list.map((item) => h('div', { class: 'hokm-trick-card' }, cardEl(item.card, { small: true }), h('span', { class: 'small faint', text: match.seats[item.seat].name }))),
      );
    }

    function humanTeamWon(team) {
      return match.seats.some((seat, i) => seat.kind === 'human' && i % 2 === team);
    }

    function updateStatus() {
      if (match.phase === 'matchEnd') return;
      if (match.phase === 'trump') {
        statusEl.textContent = isHuman(match.hakem)
          ? 'حاکم هستی؛ با دیدن پنج برگ اول، حکم را تعیین کن.'
          : `${match.seats[match.hakem].name} دارد حکم را انتخاب می‌کند…`;
        return;
      }
      if (match.phase === 'roundEnd') {
        statusEl.textContent = 'دست تمام شد.';
        return;
      }
      statusEl.innerHTML = `نوبت <strong>${match.seats[match.turn].name}</strong>${match.turn === 2 ? ' (شریک تو)' : ''}.`;
    }

    function chooseTrumpNow(suit) {
      if (match.phase !== 'trump' || !isHuman(match.hakem)) return;
      match = chooseTrump(match, suit);
      play('card');
      render();
      scheduleAi();
    }

    function playCardNow(seat, cardId) {
      if (match.phase !== 'play' || match.turn !== seat || busy) return;
      const legal = legalCards(match, seat);
      if (!legal.some((card) => card.id === cardId)) {
        toast('باید از خال زمین‌شده بازی کنی');
        play('wrong');
        return;
      }
      match = playCard(match, seat, cardId);
      play('card');
      afterMove();
    }

    function afterMove() {
      render();
      if (match.phase === 'roundEnd') {
        showRoundEnd();
        return;
      }
      if (match.phase === 'matchEnd') {
        showMatchEnd();
        return;
      }
      scheduleAi();
    }

    function scheduleAi() {
      if (timer) clearTimeout(timer);
      timer = null;
      if (match.phase === 'trump') {
        if (isHuman(match.hakem)) return;
        busy = true;
        timer = setTimeout(() => {
          busy = false;
          match = chooseTrump(match, aiChooseTrump(match.hands[match.hakem]));
          play('place');
          afterMove();
        }, 700);
        return;
      }
      if (match.phase !== 'play') return;
      const seat = match.turn;
      if (isHuman(seat)) return;
      busy = true;
      timer = setTimeout(() => {
        busy = false;
        const card = aiPlay(match, seat);
        if (!card) return;
        match = playCard(match, seat, card.id);
        afterMove();
      }, 700);
    }

    function showRoundEnd() {
      const winner = match.roundWinner;
      const humanWon = humanTeamWon(winner);
      if (match.seats.some((seat) => seat.kind === 'human')) ctx.record(humanWon ? 'win' : 'loss');
      play(humanWon ? 'win' : 'lose');
      openModal({
        title: humanWon ? 'این دست را بردیم' : 'این دست را باختیم',
        body: h('p', { text: `هفت دست تیم ${winner + 1} — نتیجه‌ی دست‌ها: ${faNum(match.teamTricks[0])} — ${faNum(match.teamTricks[1])}` }),
        actions: [
          {
            label: 'دست بعد',
            variant: 'primary',
            onClick: () => {
              match = startNextRound(match);
              render();
              scheduleAi();
            },
          },
          { label: 'بستن', variant: 'ghost' },
        ],
      });
    }

    function showMatchEnd() {
      const winner = match.scores[0] >= 2 ? 0 : 1;
      const humanWon = humanTeamWon(winner);
      play(humanWon ? 'win' : 'lose');
      openModal({
        title: humanWon ? 'بازی را بردیم' : 'بازی را باختیم',
        body: h('p', { text: `تیم ${winner + 1} دو دست برد.` }),
        actions: [
          { label: 'بازی جدید', variant: 'primary', onClick: restart },
          { label: 'بستن', variant: 'ghost' },
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
