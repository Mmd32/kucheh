import { h, s, btn, segmented, openModal, toast } from '../../core/ui.js';
import { faNum } from '../../core/i18n.js';
import { play } from '../../core/sound.js';
import { HANGMAN_WORDS } from '../../data/words-hangman.js';
import { ALPHABET, visibleCells, wrongLetters, isSolved, missingLetters, MAX_WRONG, normalizeChar } from './engine.js';

const LIMITS = { easy: 8, medium: 6, hard: 4 };

function drawing(wrong, limit) {
  const svg = s('svg', { class: 'hangman-draw', viewBox: '0 0 180 215', role: 'img', 'aria-label': `${faNum(wrong)} خط از ${faNum(limit)}` });
  svg.append(
    s('line', { x1: 20, y1: 205, x2: 150, y2: 205, class: 'hm-line' }),
    s('line', { x1: 50, y1: 205, x2: 50, y2: 25, class: 'hm-line' }),
    s('line', { x1: 50, y1: 25, x2: 120, y2: 25, class: 'hm-line' }),
  );
  if (wrong >= 1) {
    svg.append(s('line', { x1: 120, y1: 25, x2: 120, y2: 50, class: 'hm-line' }), s('circle', { cx: 120, cy: 53, r: 4, class: 'hm-line', fill: 'none' }));
  }
  if (wrong >= 2) svg.append(s('circle', { cx: 120, cy: 74, r: 17, class: 'hm-line' }));
  if (wrong >= 3) svg.append(s('line', { x1: 120, y1: 92, x2: 120, y2: 145, class: 'hm-line' }));
  if (wrong >= 4) svg.append(s('line', { x1: 120, y1: 108, x2: 96, y2: 130, class: 'hm-line' }));
  if (wrong >= 5) svg.append(s('line', { x1: 120, y1: 108, x2: 144, y2: 130, class: 'hm-line' }));
  if (wrong >= 6) {
    svg.append(s('line', { x1: 120, y1: 145, x2: 102, y2: 178, class: 'hm-line' }), s('line', { x1: 120, y1: 145, x2: 138, y2: 178, class: 'hm-line' }));
  }
  return svg;
}

export default {
  id: 'hangman',
  title: 'هنگ‌من',
  subtitle: 'حرف حدس بزن، کلمه را نجات بده',
  meta: 'یک‌نفره',
  keywords: ['هنگمن', 'کلمه', 'حدس'],
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 21V4h9v3"/><path d="M5 21h7"/><circle cx="16" cy="10" r="2.4"/><path d="M16 12.4v4M16 16.4l-1.8 2M16 16.4l1.8 2"/></svg>',
  mount(root, ctx) {
    let entry = null;
    let guessed = new Set();
    let wrong = 0;
    let over = false;
    let level = 'medium';
    let limit = LIMITS[level];

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
          limit = LIMITS[level];
          nextWord();
        },
      },
    );

    const statusEl = h('div', { class: 'game-status', role: 'status' });
    const drawSlot = h('div', { class: 'hangman-slot' });
    const wordEl = h('div', { class: 'hangman-word', role: 'group', 'aria-label': 'کلمه' });
    const keysEl = h('div', { class: 'hangman-keys', role: 'group', 'aria-label': 'صفحه‌کلید حروف' });
    const wrongEl = h('div', { class: 'hangman-wrong small' });

    const keys = new Map();
    for (const letter of ALPHABET) {
      const key = h('button', {
        type: 'button',
        class: 'key',
        text: letter,
        'aria-label': `حرف ${letter}`,
        onClick: () => guess(letter),
      });
      keys.set(letter, key);
      keysEl.append(key);
    }

    function nextWord() {
      entry = HANGMAN_WORDS[Math.floor(Math.random() * HANGMAN_WORDS.length)];
      guessed = new Set();
      wrong = 0;
      over = false;
      paint();
    }

    function paint() {
      drawSlot.replaceChildren(drawing(Math.min(wrong, 6), limit));
      const cells = visibleCells(entry.word, guessed);
      wordEl.replaceChildren(
        ...cells.map((cell) =>
          h(
            'span',
            { class: `hangman-letter ${cell.hidden ? 'is-hidden' : ''} ${cell.spacer ? 'is-space' : ''}`.trim() },
            cell.hidden ? '—' : cell.char,
          ),
        ),
      );
      const wrongs = wrongLetters(entry.word, guessed);
      wrongEl.replaceChildren(
        h('span', { class: 'muted', text: `دسته: ${entry.category}` }),
        wrongs.length ? h('span', { class: 'chip chip-danger', text: `غلط: ${wrongs.join(' ')}` }) : h('span', { class: 'chip', text: `${faNum(limit - wrong)} شانس` }),
      );

      keys.forEach((key, letter) => {
        key.disabled = guessed.has(letter) || over;
        key.classList.toggle('is-correct', guessed.has(letter) && !wrongs.includes(letter));
        key.classList.toggle('is-wrong', wrongs.includes(letter));
      });

      if (!over) {
        statusEl.innerHTML = `یک حرف بزن — ${faNum(Math.max(0, limit - wrong))} اشتباه دیگر مجاز است.`;
      }
    }

    function guess(letter) {
      if (over || guessed.has(letter)) return;
      guessed.add(letter);
      const wrongs = wrongLetters(entry.word, guessed);
      wrong = wrongs.length;
      const hasLetter = [...entry.word].some((ch) => normalizeChar(ch) === letter);

      if (hasLetter) play('correct');
      else play('wrong');
      paint();

      if (isSolved(entry.word, guessed)) {
        over = true;
        play('win');
        ctx.record('win');
        statusEl.textContent = 'نجاتش دادی!';
        openModal({
          title: 'آفرین',
          body: h('p', {}, 'کلمه ', h('strong', { text: entry.word }), ' بود.'),
          actions: [
            { label: 'کلمه‌ی بعدی', variant: 'primary', onClick: nextWord },
            { label: 'بستن', variant: 'ghost' },
          ],
        });
        return;
      }

      if (wrong >= limit) {
        over = true;
        play('lose');
        ctx.record('loss');
        statusEl.textContent = 'باختی — کلمه لو رفت.';
        openModal({
          title: 'باختی',
          body: h('p', {}, 'کلمه ', h('strong', { text: entry.word }), ' بود.'),
          actions: [
            { label: 'کلمه‌ی بعدی', variant: 'primary', onClick: nextWord },
            { label: 'بستن', variant: 'ghost' },
          ],
        });
      }
    }

    function hint() {
      if (over) return;
      const missing = missingLetters(entry.word, guessed);
      if (!missing.length) return;
      const letter = missing[Math.floor(Math.random() * missing.length)];
      toast(`حرف «${letter}» در کلمه هست`);
      guess(letter);
    }

    function handleKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('.modal-backdrop')) return;
      const letter = e.key;
      if (ALPHABET.includes(letter)) {
        e.preventDefault();
        guess(letter);
      }
    }

    document.addEventListener('keydown', handleKey);

    root.append(
      h(
        'div',
        { class: 'game' },
        h('div', { class: 'game-bar' }, h('div', { class: 'bar-group' }, levelControl, btn('راهنما', { variant: 'soft', onClick: hint }), btn('کلمه‌ی جدید', { variant: 'ghost', onClick: nextWord }))),
        statusEl,
        h('div', { class: 'game-body hangman-layout' }, drawSlot, h('div', { class: 'hangman-main' }, wordEl, wrongEl, keysEl)),
      ),
    );

    nextWord();

    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  },
};
