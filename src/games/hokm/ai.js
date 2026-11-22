// هوش مصنوعی حکم: انتخاب حکم و بازی برگ.

import { SUITS, TEAM, legalCards, trickWinner } from './engine.js';

export function aiChooseTrump(hand) {
  const score = { S: 0, H: 0, D: 0, C: 0 };
  for (const card of hand) {
    score[card.suit] += 1;
    if (card.rank >= 12) score[card.suit] += 1;
  }
  return SUITS.reduce((best, suit) => (score[suit] > score[best] ? suit : best), SUITS[0]);
}

export function aiPlay(match, seat, rng = Math.random) {
  const legal = legalCards(match, seat);
  if (!legal.length) return null;
  const level = match.level || 'normal';
  const noise = level === 'easy' ? 0.25 : level === 'hard' ? 0 : 0.08;
  const sorted = legal.slice().sort((a, b) => a.rank - b.rank);

  if (rng() < noise) return sorted[Math.floor(rng() * sorted.length)];

  if (!match.trick.length) {
    const groups = new Map();
    for (const card of sorted) {
      if (card.suit === match.trump) continue;
      if (!groups.has(card.suit)) groups.set(card.suit, []);
      groups.get(card.suit).push(card);
    }
    let bestGroup = null;
    for (const group of groups.values()) {
      if (!bestGroup || group.length > bestGroup.length) bestGroup = group;
    }
    if (bestGroup) return bestGroup[bestGroup.length - 1];
    const trumps = sorted.filter((card) => card.suit === match.trump);
    return trumps.length ? trumps[trumps.length - 1] : sorted[sorted.length - 1];
  }

  const winner = trickWinner(match);
  const partnerWinning = winner && TEAM(winner.seat) === TEAM(seat);
  if (partnerWinning) return sorted[0];

  const beating = legal.filter((card) => trickWinner({ ...match, trick: [...match.trick, { seat, card }] }).seat === seat);
  if (beating.length) {
    return beating.reduce((low, card) => (card.rank < low.rank ? card : low));
  }
  return sorted[0];
}
