import { h, btn, segmented, toast } from '../../core/ui.js';
import { faNum } from '../../core/i18n.js';
import { play } from '../../core/sound.js';
import { shuffle } from '../../core/rng.js';
import { CHARADES_DECKS } from '../../data/words-charades.js';

export default {
  id: 'charades',
  title: 'پانتومیم',
  subtitle: 'بدون حرف، فقط با حرکت',
  meta: 'تیمی · ۲ تا ۴ تیم',
  keywords: ['پانتومیم', 'شاراد', 'تیم', 'حرکت'],
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8c0-2 1.6-3.5 3.5-3.5S11 6 11 8v6.5a2 2 0 01-4 0V8"/><path d="M13 7.5c0-1.6 1.2-3 3-3s3 1.4 3 3v7a2 2 0 01-4 0v-4"/><path d="M6 17.5l1.5 4M17 15.5l1.5 6"/></svg>',
  mount(root, ctx) {
    let screen = 'setup';
    let teamCount = 2;
    let teams = ['تیم آ', 'تیم ب'];
    let scores = [];
    let rounds = 2;
    let duration = 90;
    let deckIds = new Set(['actions', 'objects', 'animals']);
    let pool = [];
    let turn = 0;
    let round = 1;
    let results = [];
    let current = null;
    let ticker = null;
    let remaining = duration;
    let refs = null;

    const wrap = h('div', { class: 'party' });

    function render() {
      wrap.replaceChildren(...screenView());
    }

    function screenView() {
      if (screen === 'setup') return setupView();
      if (screen === 'turn') return turnView();
      if (screen === 'play') return playView();
      if (screen === 'results') return resultsView();
      return finalView();
    }

    function setupView() {
      return [
        h(
          'div',
          { class: 'panel stack' },
          h('p', {
            class: 'muted small',
            text: 'یک نفر از هر تیم کلمه را می‌بیند و با حرکت نشان می‌دهد. حرف زدن، نوشتن و هر صدا ممنوع است.',
          }),
          h(
            'div',
            { class: 'field-inline' },
            h('span', { class: 'field-label', text: 'تیم‌ها' }),
            segmented(
              [2, 3, 4].map((n) => ({ value: n, label: faNum(n) })),
              {
                value: teamCount,
                label: 'تعداد تیم',
                onChange: (v) => {
                  teamCount = v;
                  teams = ['تیم آ', 'تیم ب', 'تیم پ', 'تیم ت'].slice(0, v);
                  render();
                },
              },
            ),
          ),
          h(
            'div',
            { class: 'field-inline' },
            h('span', { class: 'field-label', text: 'زمان هر نوبت' }),
            segmented(
              [60, 90, 120].map((n) => ({ value: n, label: `${faNum(n)} ثانیه` })),
              {
                value: duration,
                label: 'زمان',
                onChange: (v) => {
                  duration = v;
                },
              },
            ),
          ),
          h(
            'div',
            { class: 'field-inline' },
            h('span', { class: 'field-label', text: 'نوبت هر تیم' }),
            segmented(
              [1, 2, 3].map((n) => ({ value: n, label: faNum(n) })),
              {
                value: rounds,
                label: 'نوبت‌ها',
                onChange: (v) => {
                  rounds = v;
                },
              },
            ),
          ),
          h(
            'div',
            { class: 'field' },
            h('span', { class: 'field-label', text: 'دسته‌ها' }),
            h(
              'div',
              { class: 'row' },
              ...CHARADES_DECKS.map((deck) => {
                const on = deckIds.has(deck.id);
                return h('button', {
                  type: 'button',
                  class: `chip chip-toggle ${on ? 'is-on' : ''}`.trim(),
                  'aria-pressed': String(on),
                  text: deck.title,
                  onClick: () => {
                    if (deckIds.has(deck.id)) {
                      if (deckIds.size === 1) {
                        toast('حداقل یک دسته لازم است');
                        return;
                      }
                      deckIds.delete(deck.id);
                    } else deckIds.add(deck.id);
                    render();
                  },
                });
              }),
            ),
          ),
          btn('شروع بازی', { variant: 'primary', onClick: startGame }),
        ),
      ];
    }

    function buildPool() {
      pool = [];
      for (const id of deckIds) {
        const deck = CHARADES_DECKS.find((d) => d.id === id);
        if (!deck) continue;
        for (const word of deck.words) pool.push({ word, cat: deck.title });
      }
      if (!pool.length) pool = [{ word: 'چتر', cat: 'اشیا' }];
      pool = shuffle(pool);
    }

    function startGame() {
      scores = Array.from({ length: teamCount }, () => 0);
      turn = 0;
      round = 1;
      buildPool();
      screen = 'turn';
      render();
    }

    function turnView() {
      return [
        h(
          'div',
          { class: 'panel stack center' },
          h('span', { class: 'chip', text: `نوبت ${faNum(round)} از ${faNum(rounds)}` }),
          h('h2', { class: 'party-team', text: teams[turn] }),
          h('p', {
            class: 'small muted',
            text: 'دست‌هایت را آماده کن. وقت تمام شد، نوبت تیم بعدی است.',
          }),
          btn('شروع نوبت', { variant: 'primary', onClick: startTurn }),
        ),
        h('p', {
          class: 'small faint center',
          text: 'قانون: فقط حرکت! حرف، صدا و اشاره به حروف ممنوع.',
        }),
      ];
    }

    function startTurn() {
      results = [];
      remaining = duration;
      current = pool.pop();
      if (!current) {
        buildPool();
        current = pool.pop();
      }
      screen = 'play';
      renderPlayWithTimer();
    }

    function renderPlayWithTimer() {
      const timeEl = h('span', { class: 'party-time', text: `${faNum(Math.ceil(remaining))}″` });
      const bar = h('div', { class: 'timer-fill', style: { width: '100%' } });
      const wordEl = h('span', { class: 'party-word', text: current.word });
      const catEl = h('span', { class: 'party-cat', text: `${current.cat} · فقط حرکت` });
      const scoreEl = h('span', { class: 'chip chip-accent', text: `${faNum(results.filter((r) => r.ok).length)} درست` });

      wrap.replaceChildren(
        h(
          'div',
          { class: 'game-bar' },
          h('div', { class: 'bar-group' }, h('span', { class: 'chip', text: teams[turn] }), scoreEl),
          h('div', { class: 'bar-group' }, timeEl),
        ),
        h('div', { class: 'timer-line' }, bar),
        h(
          'div',
          { class: 'party-card party-card-big' },
          catEl,
          wordEl,
          h('span', { class: 'party-note small faint', text: '0628062f06480646 062d06310641060c 0628062f06480646 0635062f0627' }),
        ),
        h(
          'div',
          { class: 'party-actions' },
          btn('درست', { variant: 'primary', className: 'party-btn', onClick: () => judge(true) }),
          btn('رد', { variant: 'soft', className: 'party-btn', onClick: () => judge(false) }),
        ),
      );

      refs = { timeEl, bar, wordEl, catEl, scoreEl };

      const endAt = Date.now() + duration * 1000;
      ticker = setInterval(() => {
        const left = Math.max(0, endAt - Date.now());
        remaining = left / 1000;
        refs.timeEl.textContent = `${faNum(Math.ceil(remaining))}″`;
        refs.bar.style.width = `${(left / (duration * 1000)) * 100}%`;
        refs.bar.classList.toggle('is-low', remaining <= 10);
        if (left <= 0) endTurn();
      }, 100);
    }

    function playView() {
      return [h('div', { class: 'panel center', text: 'در حال بازی…' })];
    }

    function judge(ok) {
      if (screen !== 'play' || !current || !ticker) return;
      results.push({ word: current.word, ok });
      play(ok ? 'correct' : 'wrong');
      if (refs) refs.scoreEl.textContent = `${faNum(results.filter((r) => r.ok).length)} درست`;
      current = pool.pop();
      if (!current) {
        buildPool();
        current = pool.pop();
      }
      if (refs && current) {
        refs.wordEl.textContent = current.word;
        refs.catEl.textContent = `${current.cat} · فقط حرکت`;
      }
    }

    function endTurn() {
      if (ticker) clearInterval(ticker);
      ticker = null;
      screen = 'results';
      scores[turn] += results.filter((r) => r.ok).length;
      play('tick');
      render();
    }

    function resultsView() {
      const gained = results.filter((r) => r.ok).length;
      return [
        h(
          'div',
          { class: 'panel stack' },
          h('h2', { class: 'party-team', text: `${teams[turn]}: ${faNum(gained)} امتیاز` }),
          h(
            'ul',
            { class: 'list' },
            ...results.map((r) =>
              h(
                'li',
                { class: `list-item ${r.ok ? 'is-good' : 'is-bad'}` },
                h('span', { text: r.word }),
                h('span', { class: 'small', text: r.ok ? 'درست' : 'ردشده' }),
              ),
            ),
          ),
          h('div', { class: 'row' }, btn('تیم بعدی', { variant: 'primary', onClick: advance })),
        ),
      ];
    }

    function advance() {
      turn = (turn + 1) % teamCount;
      if (turn === 0) {
        round += 1;
        if (round > rounds) {
          screen = 'final';
          render();
          return;
        }
      }
      screen = 'turn';
      render();
    }

    function finalView() {
      const best = Math.max(...scores);
      const winners = teams.filter((_, i) => scores[i] === best);
      return [
        h(
          'div',
          { class: 'panel stack center' },
          h('h2', { class: 'party-team', text: `${winners.join(' و ')} برد` }),
          h(
            'ul',
            { class: 'list' },
            ...teams.map((name, i) => h('li', { class: 'list-item' }, h('span', { text: name }), h('strong', { text: faNum(scores[i]) }))),
          ),
          h(
            'div',
            { class: 'row', style: { justifyContent: 'center' } },
            btn('دست دیگر', { variant: 'primary', onClick: () => { screen = 'setup'; render(); } }),
            btn('بستن', { variant: 'soft', onClick: () => ctx.exit() }),
          ),
        ),
      ];
    }

    let hiddenPause = null;

    function onVisibility() {
      if (screen !== 'play' || !ticker) return;
      if (document.hidden) {
        clearInterval(ticker);
        ticker = null;
        hiddenPause = true;
      } else if (hiddenPause) {
        hiddenPause = null;
        endTurn();
      }
    }
    document.addEventListener('visibilitychange', onVisibility);

    root.append(wrap);
    render();

    return () => {
      if (ticker) clearInterval(ticker);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  },
};
