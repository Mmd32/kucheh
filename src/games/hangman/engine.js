// هنگ‌من: تشخیص حروف و وضعیت کلمه.

export const ALPHABET = [...'ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی'];

const ZWNJ = '\u200c';

export function normalizeChar(ch) {
  return ch
    .replace(/[آأإ]/g, 'ا')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ی')
    .replace(/ۀ/g, 'ه');
}

export function normalizeWord(word) {
  return [...word].map((ch) => normalizeChar(ch)).join('');
}

export function visibleCells(word, guessed) {
  return [...word].map((ch) => {
    if (ch === ' ' || ch === ZWNJ) {
      return { char: ch === ' ' ? '\u00a0' : ZWNJ, hidden: false, spacer: true };
    }
    const letter = normalizeChar(ch);
    return { char: ch, hidden: !guessed.has(letter), spacer: false, letter };
  });
}

export function wrongLetters(word, guessed) {
  const norm = normalizeWord(word);
  return [...guessed].filter((letter) => !norm.includes(letter));
}

export function isSolved(word, guessed) {
  const norm = normalizeWord(word);
  for (const ch of norm) {
    if (ch === ' ' || ch === ZWNJ) continue;
    if (!guessed.has(ch)) return false;
  }
  return true;
}

export function missingLetters(word, guessed) {
  const norm = normalizeWord(word);
  const out = new Set();
  for (const ch of norm) {
    if (ch === ' ' || ch === ZWNJ) continue;
    if (!guessed.has(ch)) out.add(ch);
  }
  return [...out];
}

export const MAX_WRONG = 6;
