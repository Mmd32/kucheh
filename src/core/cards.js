import { h } from './ui.js';

export const SUIT_INFO = {
  S: { glyph: '♠', name: 'پیک', red: false },
  H: { glyph: '♥', name: 'دل', red: true },
  D: { glyph: '♦', name: 'خشت', red: true },
  C: { glyph: '♣', name: 'گشنیز', red: false },
};

export const RANK_LABEL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export function rankLabel(rank) {
  return RANK_LABEL[rank] || String(rank);
}

export function createDeck() {
  const deck = [];
  for (const suit of Object.keys(SUIT_INFO)) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ id: `${suit}${rank}`, suit, rank });
    }
  }
  return deck;
}

export function shuffleDeck(deck, rng = Math.random) {
  const out = deck.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// بدنه‌ی کارت: خال‌های کوچک برای ۲ تا ۱۰، حرف برای تصویری‌ها، خال بزرگ برای آس
function faceContent(card, glyph) {
  const rank = card.rank;
  if (rank >= 11 && rank <= 13) {
    const label = rank === 11 ? 'J' : rank === 12 ? 'Q' : 'K';
    return [h('span', { class: 'card-mid', 'aria-hidden': 'true', text: label })];
  }
  if (rank === 14) {
    return [h('span', { class: 'card-mid', 'aria-hidden': 'true', text: glyph })];
  }
  const pips = [];
  for (let i = 0; i < rank; i++) pips.push(h('span', { text: glyph }));
  return [h('span', { class: 'pips', 'aria-hidden': 'true' }, ...pips)];
}

export function cardEl(card, { onClick = null, disabled = false, small = false, highlight = false } = {}) {
  const info = SUIT_INFO[card.suit];
  const classes = [
    'pcard',
    info.red ? 'is-red' : '',
    small ? 'is-small' : '',
    highlight ? 'is-highlight' : '',
    card.rank === 14 ? 'is-ace' : '',
    card.rank >= 11 && card.rank <= 13 ? 'is-court' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return h(
    'button',
    {
      type: 'button',
      class: classes,
      'aria-label': `${rankLabel(card.rank)} ${info.name}`,
      'data-rank': rankLabel(card.rank),
      'data-suit': info.glyph,
      disabled: Boolean(disabled) || !onClick,
      onClick: onClick || undefined,
    },
    h('span', { class: 'card-rank', text: rankLabel(card.rank) }),
    h('span', { class: 'card-suit', text: info.glyph, 'aria-hidden': 'true' }),
    ...faceContent(card, info.glyph),
    h(
      'span',
      { class: 'card-corner', 'aria-hidden': 'true' },
      h('span', { text: rankLabel(card.rank) }),
      h('span', { text: info.glyph }),
    ),
  );
}

export function cardBack(small = false) {
  return h('span', { class: `pcard pcard-back ${small ? 'is-small' : ''}`.trim(), 'aria-hidden': 'true' });
}
