import { h, openModal, toast, btn, segmented, fieldInline, confirmDialog, closeAllModals } from './core/ui.js';
import {
  applySettings,
  getSettings,
  setSetting,
  getStat,
  listSaves,
  clearStats,
  saveGame,
  loadGame,
  clearSavedGame,
  recordStat,
  exportData,
  importData,
  clearAllSaves,
} from './core/store.js';
import { faNum } from './core/i18n.js';
import { HELP } from './data/help.js';
import { play } from './core/sound.js';
import { games } from './games/registry.js';

const app = document.getElementById('app');
let dispose = null;

applySettings();

const ICONS = {
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2.1M12 18.4v2.1M3.5 12h2.1M18.4 12h2.1M6.1 6.1l1.5 1.5M16.4 16.4l1.5 1.5M17.9 6.1l-1.5 1.5M7.6 16.4l-1.5 1.5"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  search:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  mark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14.5l4.5-4.5 3.2 3.2L19 6.5"/><path d="M4 19h16"/></svg>',
  soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4z"/><path d="M16 8.6a4.6 4.6 0 010 6.8"/><path d="M18.6 6.2a8 8 0 010 11.6"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M9.4 9.2a2.7 2.7 0 015.2.9c0 1.8-2.6 2-2.6 3.8"/><path d="M12 17.2h.01"/></svg>',
};

const CATEGORY = {
  board: ['chess', 'backgammon', 'manch', 'snakes', 'battleship'],
  cards: ['hokm', 'chaharbarg', 'blackjack'],
  puzzle: ['minesweeper', 'parking', 'pipes', 'sudoku', 'crossword', 'dots', 'tictactoe', 'hangman'],
  arcade: ['snake', 'billiards'],
  party: ['headsup', 'charades'],
};

function categoryOf(id) {
  for (const [key, ids] of Object.entries(CATEGORY)) if (ids.includes(id)) return key;
  return 'board';
}

function heroArt() {
  return h('div', {
    class: 'hero-art',
    'aria-hidden': 'true',
    html: `<svg viewBox="0 0 280 280" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M24 258V132C24 78 76 44 140 44s116 34 116 88v126" opacity=".45"/>
      <path d="M44 258V138c0-41 43-70 96-70s96 29 96 70v120" opacity=".7"/>
      <path d="M64 258V144c0-31 33-54 76-54s76 23 76 54v114" opacity=".35"/>
      <path d="M140 90v168M24 200h116M140 200h116" opacity=".25"/>
      <rect x="76" y="118" width="34" height="44" rx="3" opacity=".45"/>
      <path d="M93 118v44M76 140h34" opacity=".3"/>
      <rect x="170" y="118" width="34" height="44" rx="3" opacity=".45"/>
      <path d="M187 118v44M170 140h34" opacity=".3"/>
      <path d="M170 226c14-7 26-5 34 4" opacity=".5"/>
      <circle cx="112" cy="232" r="9" opacity=".8"/>
      <path d="M96 226c-8-3-14-9-17-17" opacity=".4"/>
      <path d="M62 250h20v12H62zM86 250h20v12H86zM74 264h20v12H74z" opacity=".35"/>
      <path d="M226 214l10 8-10 8" opacity=".4"/>
    </svg>`,
  });
}

function navigate(path) {
  if (location.hash === path) render();
  else location.hash = path;
}

function safeDecode(part) {
  try {
    return decodeURIComponent(part);
  } catch (err) {
    return part;
  }
}

function parseHash() {
  let raw = '';
  try {
    raw = location.hash.replace(/^#\/?/, '');
  } catch (err) {
    raw = '';
  }
  const parts = raw.split('/').filter(Boolean).map(safeDecode);
  if (parts[0] === 'game' && parts[1]) return { name: 'game', id: parts[1] };
  return { name: 'home' };
}

function render() {
  closeAllModals();
  if (dispose) {
    try {
      dispose();
    } catch (err) {
      /* پاک‌سازی بازی نباید مانع رفتن به صفحه بعد شود. */
    }
    dispose = null;
  }
  const route = parseHash();
  const game = route.name === 'game' ? games.find((g) => g.id === route.id) : null;
  if (game) {
    renderGame(game);
    document.title = `${game.title} — کوچه`;
  } else {
    renderHome();
    document.title = 'کوچه';
  }
  window.scrollTo(0, 0);
}

/* ---------------- home ---------------- */

function statLine(stat) {
  if (!stat || !stat.plays) return null;
  const parts = [];
  if (stat.wins) parts.push(`${faNum(stat.wins)} برد`);
  if (stat.losses) parts.push(`${faNum(stat.losses)} باخت`);
  if (stat.draws) parts.push(`${faNum(stat.draws)} مساوی`);
  if (stat.best) parts.push(`رکورد ${faNum(stat.best)}`);
  return parts.length ? parts.join(' · ') : null;
}

function makeCard(game, save, stat) {
  const saved = Boolean(save);
  return h(
    'button',
    { type: 'button', class: `card cat-${categoryOf(game.id)}`, onClick: () => navigate(`#/game/${game.id}`) },
    h('span', { class: 'card-icon', html: game.icon }),
    h('span', { class: 'card-title', text: game.title }),
    h('span', { class: 'card-sub', text: game.subtitle }),
    h(
      'span',
      { class: 'card-foot' },
      h('span', { class: 'chip', text: game.meta }),
      saved ? h('span', { class: 'chip chip-accent', text: 'ادامهی بازی' }) : null,
      statLine(stat) ? h('span', { class: 'small faint', text: statLine(stat) }) : null,
    ),
  );
}

function renderHome() {
  const saves = listSaves();
  const cards = games.map((game) => makeCard(game, saves[game.id], getStat(game.id)));
  const grid = h('div', { class: 'cards' }, cards);
  const empty = h('p', { class: 'muted center small', text: 'بازی‌ای با این نام پیدا نشد.', hidden: true });
  const countChip = h('span', { class: 'chip', text: `${faNum(games.length)} بازی` });

  const search = h('input', {
    class: 'input search-input',
    type: 'search',
    placeholder: 'جست‌وجوی بازی…',
    'aria-label': 'جست‌وجوی بازی',
  });

  search.addEventListener('input', () => {
    const q = search.value.trim();
    let shown = 0;
    cards.forEach((card, i) => {
      const game = games[i];
      const haystack = `${game.title} ${game.subtitle} ${(game.keywords || []).join(' ')}`;
      const match = !q || haystack.includes(q);
      card.hidden = !match;
      if (match) shown += 1;
    });
    empty.hidden = shown > 0;
    countChip.textContent = `${faNum(shown)} از ${faNum(games.length)} بازی`;
  });

  app.replaceChildren(
    h(
      'header',
      { class: 'app-head' },
      h(
        'div',
        { class: 'brand-word' },
        h('span', { class: 'brand-mark', html: ICONS.mark }),
        h('span', { class: 'brand-name', text: 'کوچه' }),
      ),
      h('div', { class: 'head-actions' }, soundButton(), settingsButton()),
    ),
    h(
      'main',
      { class: 'home', id: 'main' },
      h(
        'section',
        { class: 'home-hero' },
        h(
          'div',
          { class: 'hero-copy' },
          h('span', { class: 'eyebrow', text: 'بازی‌های کوچه' }),
          h('h1', { class: 'home-title', text: 'کوچه' }),
          h('p', {
            class: 'lead',
            text: 'قدیم‌ها توی کوچه بازی می‌کردیم؛ حالا همان کوچه، همین‌جاست. بیست بازی کوتاه، روی همین گوشی، با هم یا با کامپیوتر — بدون حساب کاربری و بدون اینترنت.',
          }),
          h('div', { class: 'search-wrap' }, h('span', { html: ICONS.search }), search),
        ),
        heroArt(),
      ),
      h(
        'div',
        { class: 'section-head' },
        h('h2', { class: 'section-title', text: 'همه‌ی بازی‌ها' }),
        countChip,
      ),
      grid,
      empty,
      h(
        'footer',
        { class: 'app-foot' },
        h('p', { class: 'foot-storage', text: 'همه‌چیز روی همین دستگاه ذخیره می‌شود؛ نه حسابی لازم است، نه اینترنتی.' }),
        h(
          'p',
          { class: 'foot-credit' },
          h('span', { text: 'ساخته شده با ' }),
          h('span', { class: 'heart-icon', 'aria-label': 'عشق', text: '❤️' }),
          h('span', { text: ' توسط ' }),
          h('a', {
            href: 'https://x.com/son_of_jobs',
            target: '_blank',
            rel: 'noopener noreferrer',
            class: 'foot-author',
            text: 'پسر استیو',
          }),
        ),
      ),
    ),
  );
}

function helpButton(game) {
  const lines = HELP[game.id] || [];
  return h('button', {
    type: 'button',
    class: 'icon-btn',
    'aria-label': `راهنمای ${game.title}`,
    html: ICONS.help,
    onClick: () => {
      openModal({
        title: `راهنمای ${game.title}`,
        body: h(
          'div',
          { class: 'help' },
          h('p', { class: 'help-sub', text: game.subtitle }),
          h(
            'ul',
            { class: 'help-list' },
            ...lines.map((line) => h('li', { text: line })),
          ),
        ),
        actions: [{ label: 'فهمیدم', variant: 'primary' }],
      });
    },
  });
}

function soundButton() {
  const button = h('button', {
    type: 'button',
    class: 'icon-btn',
    'aria-label': getSettings().sound ? 'خاموش کردن صدا' : 'روشن کردن صدا',
    html: getSettings().sound ? ICONS.soundOn : ICONS.soundOff,
    onClick: () => {
      const next = !getSettings().sound;
      setSetting('sound', next);
      if (next) play('click');
    },
  });
  const sync = () => {
    const on = getSettings().sound;
    button.innerHTML = on ? ICONS.soundOn : ICONS.soundOff;
    button.setAttribute('aria-label', on ? 'خاموش کردن صدا' : 'روشن کردن صدا');
  };
  window.addEventListener('settings:change', sync);
  return button;
}



function settingsButton() {
  return h('button', {
    type: 'button',
    class: 'icon-btn',
    'aria-label': 'تنظیمات',
    html: ICONS.gear,
    onClick: openSettings,
  });
}

function openSettings() {
  const settings = getSettings();

  const body = h(
    'div',
    { class: 'settings' },
    fieldInline(
      'اعداد',
      segmented(
        [
          { value: 'fa', label: 'فارسی' },
          { value: 'en', label: 'لاتین' },
        ],
        { value: settings.numerals, label: 'اعداد', onChange: (v) => setSetting('numerals', v) },
      ),
    ),
    fieldInline(
      'صدا',
      segmented(
        [
          { value: true, label: 'روشن' },
          { value: false, label: 'خاموش' },
        ],
        { value: settings.sound, label: 'صدا', onChange: (v) => setSetting('sound', v) },
      ),
    ),
    fieldInline(
      'پوسته',
      segmented(
        [
          { value: 'light', label: 'روشن' },
          { value: 'dark', label: 'تیره' },
        ],
        { value: settings.theme, label: 'پوسته', onChange: (v) => setSetting('theme', v) },
      ),
    ),
    fieldInline(
      'اندازه‌ی تخته',
      segmented(
        [
          { value: 0.85, label: 'کوچک' },
          { value: 1, label: 'معمولی' },
          { value: 1.15, label: 'بزرگ' },
        ],
        { value: settings.boardScale, label: 'اندازه‌ی تخته', onChange: (v) => setSetting('boardScale', v) },
      ),
    ),
    fieldInline(
      'انیمیشن',
      segmented(
        [
          { value: 'full', label: 'کامل' },
          { value: 'reduced', label: 'کم' },
        ],
        { value: settings.motion, label: 'انیمیشن', onChange: (v) => setSetting('motion', v) },
      ),
    ),
    fieldInline(
      'نام تو',
      h('input', {
        class: 'input',
        type: 'text',
        maxlength: '20',
        placeholder: 'مثلاً رضا',
        value: settings.playerName || '',
        'aria-label': 'نام بازیکن',
        onChange: (e) => setSetting('playerName', e.target.value.trim().slice(0, 20)),
      }),
    ),
    h(
      'div',
      { class: 'settings-foot' },
      btn('پاک‌کردن آمار بازی‌ها', {
        variant: 'soft',
        onClick: () => {
          confirmDialog({
            title: 'پاک‌کردن آمار',
            text: 'همه‌ی بردها، باخت‌ها و رکوردها پاک می‌شوند. بازی‌های ذخیره‌شده دست نمی‌خورند.',
            confirmLabel: 'پاک کن',
            onConfirm: () => {
              clearStats();
              toast('آمار پاک شد');
            },
          });
        },
      }),
      btn('پاک‌کردن بازی‌های ذخیره‌شده', {
        variant: 'soft',
        onClick: () => {
          confirmDialog({
            title: 'پاک‌کردن بازی‌های نیمه‌تمام',
            text: 'فقط وضعیت بازی‌های ذخیره‌شده پاک می‌شود؛ آمار و تنظیمات می‌مانند.',
            confirmLabel: 'پاک کن',
            onConfirm: () => {
              clearAllSaves();
              toast('بازی‌های ذخیره‌شده پاک شد');
            },
          });
        },
      }),
      btn('پشتیبان‌گیری', {
        variant: 'ghost',
        onClick: () => {
          const blob = new Blob([exportData()], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = h('a', { href: url, download: `kucheh-backup-${new Date().toISOString().slice(0, 10)}.json` });
          document.body.append(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
          toast('فایل پشتیبان ساخته شد');
        },
      }),
      btn('بازیابی از فایل', {
        variant: 'ghost',
        onClick: () => {
          const input = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only' });
          input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            if (!file) return;
            const text = await file.text();
            const result = importData(text);
            if (result.ok) {
              toast('داده‌ها بازیابی شد');
              applySettings();
              window.dispatchEvent(new CustomEvent('settings:change', { detail: getSettings() }));
              render();
            } else {
              toast(result.reason, { duration: 4000 });
            }
          });
          document.body.append(input);
          input.click();
          setTimeout(() => input.remove(), 1000);
        },
      }),
    ),
  );

  openModal({
    title: 'تنظیمات',
    body,
    actions: [{ label: 'بستن', variant: 'primary' }],
  });
}

/* ---------------- game ---------------- */

function renderGame(game) {
  const main = h('main', { class: 'game-page', id: 'main' });

  app.replaceChildren(
    h(
      'header',
      { class: 'app-head app-head-game' },
      h('button', {
        type: 'button',
        class: 'icon-btn',
        'aria-label': 'بازگشت به فهرست بازی‌ها',
        html: ICONS.back,
        onClick: () => navigate('#/'),
      }),
      h(
        'div',
        { class: 'head-title' },
        h('span', { class: 'head-name', text: game.title }),
        h('span', { class: 'head-sub', text: game.subtitle }),
      ),
      h('div', { class: 'head-actions' }, helpButton(game), soundButton(), settingsButton()),
    ),
    main,
  );

  const ctx = {
    navigate,
    toast,
    play: (name) => play(name),
    save: (data) => saveGame(game.id, data),
    load: () => loadGame(game.id),
    clearSave: () => clearSavedGame(game.id),
    record: (result) => recordStat(game.id, result),
    stat: () => getStat(game.id),
    exit: () => navigate('#/'),
  };

  try {
    dispose = game.mount(main, ctx) || null;
  } catch (err) {
    console.error(err);
    main.append(
      h(
        'div',
        { class: 'panel' },
        h('p', { text: 'این بازی با خطا باز نشد. صفحه را دوباره بارگذاری کن.' }),
        h('pre', { class: 'small', text: String(err && err.message ? err.message : err) }),
      ),
    );
  }
}

window.addEventListener('hashchange', render);
render();
