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

export function cardEl(card, { onClick = null, disabled = false, small = false, highlight = false } = {}) {
  const info = SUIT_INFO[card.suit];
  return h(
    'button',
    {
      type: 'button',
      class: `pcard ${info.red ? 'is-red' : ''} ${small ? 'is-small' : ''} ${highlight ? 'is-highlight' : ''}`.trim(),
      'aria-label': `${rankLabel(card.rank)} ${info.name}`,
      'data-rank': rankLabel(card.rank),
      'data-suit': info.glyph,
      disabled: Boolean(disabled) || !onClick,
      onClick: onClick || undefined,
    },
    h('span', { class: 'card-rank', text: rankLabel(card.rank) }),
    h('span', { class: 'card-suit', text: info.glyph, 'aria-hidden': 'true' }),
  );
}

export function cardBack(small = false) {
  return h('span', { class: `pcard pcard-back ${small ? 'is-small' : ''}`.trim(), 'aria-hidden': 'true' });
}
