import { h, btn, segmented, openModal, toast } from '../../core/ui.js';
import { faNum } from '../../core/i18n.js';
import { play } from '../../core/sound.js';
import { shuffle } from '../../core/rng.js';
import { HEADSUP_DECKS } from '../../data/words-headsup.js';

export default {
  id: 'headsup',
  title: 'هدز آپ',
  subtitle: 'کلمه روی صفحه، تیم حدس بزند',
  meta: 'تیمی · ۲ تا ۴ تیم',
  keywords: ['هدزآپ', 'گفتن', 'کلمه', 'تیم'],
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9.5 8h5M9.5 11.5h5M9.5 15h3"/></svg>',
  mount(root, ctx) {
    let screen = 'setup';
    let teamCount = 2;
    let teams = ['تیم آ', 'تیم ب'];
    let scores = [];
    let rounds = 3;
    let duration = 60;
    let deckIds = new Set(['objects', 'animals', 'food']);
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
      wrap.replaceChildren(...renderScreen());
    }

    function setupNames(count) {
      const labels = ['تیم آ', 'تیم ب', 'تیم پ', 'تیم ت'];
      return labels.slice(0, count);
    }

    function deckChips() {
      return HEADSUP_DECKS.map((deck) => {
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
            } else {
              deckIds.add(deck.id);
            }
            render();
          },
        });
      });
    }

    function renderScreen() {
      if (screen === 'setup') return renderSetup();
      if (screen === 'turn') return renderTurn();
      if (screen === 'play') return renderPlay();
      if (screen === 'results') return renderResults();
      return renderFinal();
    }

    function renderSetup() {
      return [
        h('div', { class: 'panel stack' },
          h('p', { class: 'muted small', text: 'یک نفر گوشی را به سمت خودش می‌گیرد و بقیه حدس می‌زنند. هرچه زودتر، بیشتر.' }),
          h('div', { class: 'field-inline' },
            h('span', { class: 'field-label', text: 'تیم‌ها' }),
            segmented(
              [2, 3, 4].map((n) => ({ value: n, label: faNum(n) })),
              { value: teamCount, label: 'تعداد تیم', onChange: (v) => { teamCount = v; teams = setupNames(v); render(); } },
            ),
          ),
          h('div', { class: 'field-inline' },
            h('span', { class: 'field-label', text: 'زمان هر دور' }),
            segmented([30, 60, 90].map((n) => ({ value: n, label: `${faNum(n)} ثانیه` })), {
              value: duration,
              label: 'زمان',
              onChange: (v) => { duration = v; },
            }),
          ),
          h('div', { class: 'field-inline' },
            h('span', { class: 'field-label', text: 'تعداد دورها' }),
            segmented([2, 3, 5].map((n) => ({ value: n, label: faNum(n) })), {
              value: rounds,
              label: 'دورها',
              onChange: (v) => { rounds = v; },
            }),
          ),
          h('div', { class: 'field' },
            h('span', { class: 'field-label', text: 'دسته‌ها' }),
            h('div', { class: 'row' }, ...deckChips()),
          ),
          btn('شروع بازی', { variant: 'primary', onClick: startGame }),
        ),
      ];
    }

    function buildPool() {
      pool = [];
      for (const id of deckIds) {
        const deck = HEADSUP_DECKS.find((d) => d.id === id);
        if (!deck) continue;
        for (const word of deck.words) pool.push({ word, cat: deck.title });
      }
      if (!pool.length) pool = [{ word: 'کتاب', cat: 'اشیا' }];
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

    function renderTurn() {
      return [
        h('div', { class: 'panel stack center' },
          h('span', { class: 'chip', text: `دور ${faNum(round)} از ${faNum(rounds)}` }),
          h('h2', { class: 'party-team', text: teams[turn] }),
          h('p', { class: 'small muted', text: 'گوشی را طوری بگیر که فقط تو کلمه را ببینی؛ آماده‌ای؟' }),
          btn('شروع دور', { variant: 'primary', onClick: startTurn }),
        ),
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
      const catEl = h('span', { class: 'party-cat', text: current.cat });
      const scoreEl = h('span', { class: 'chip chip-accent', text: `${faNum(results.filter((r) => r.ok).length)} درست` });

      const yes = btn('درست', { variant: 'primary', className: 'party-btn', onClick: () => judge(true) });
      const no = btn('رد', { variant: 'soft', className: 'party-btn', onClick: () => judge(false) });

      wrap.replaceChildren(
        h('div', { class: 'game-bar' }, h('div', { class: 'bar-group' }, h('span', { class: 'chip', text: teams[turn] }), scoreEl), h('div', { class: 'bar-group' }, timeEl)),
        h('div', { class: 'timer-line' }, bar),
        h('div', { class: 'party-card party-card-big' }, catEl, wordEl),
        h('div', { class: 'party-actions' }, yes, no),
        h('p', { class: 'small faint center', text: 'می‌توانی کلمه را توضیح بدهی، اما بخشی از خود کلمه را نگو.' }),
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

    function renderPlay() {
      return [h('div', { class: 'panel center', text: 'در حال بازی…' })];
    }

    function judge(ok) {
      if (screen !== 'play' || !current) return;
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
        refs.catEl.textContent = current.cat;
      }
    }

    function endTurn() {
      if (ticker) clearInterval(ticker);
      ticker = null;
      screen = 'results';
      const gained = results.filter((r) => r.ok).length;
      scores[turn] += gained;
      play('tick');
      render();
    }

    function renderResults() {
      const gained = results.filter((r) => r.ok).length;
      return [
        h('div', { class: 'panel stack' },
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
          btn('تیم بعدی', { variant: 'primary', onClick: advance }),
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

    function renderFinal() {
      const best = Math.max(...scores);
      const winners = teams.filter((_, i) => scores[i] === best);
      return [
        h('div', { class: 'panel stack center' },
          h('h2', { class: 'party-team', text: `${winners.join(' و ')} برد${winners.length > 1 ? 'ند' : ''}` }),
          h(
            'ul',
            { class: 'list' },
            ...teams.map((name, i) =>
              h('li', { class: 'list-item' }, h('span', { text: name }), h('strong', { text: faNum(scores[i]) })),
            ),
          ),
          h('div', { class: 'row', style: { justifyContent: 'center' } },
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
