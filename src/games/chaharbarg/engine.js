// چهار برگ: هر بازیکن چهار برگ دارد و با برگ هم‌رتبه از بازار می‌گیرد.

import { createDeck, shuffleDeck } from '../../core/cards.js';

export function cardPoints(card) {
  if (card.rank === 14) return 4;
  if (card.rank === 13) return 3;
  if (card.rank === 12) return 2;
  if (card.rank === 11) return 1;
  return 0;
}

export function createGame({ humans = 1, level = 'normal' } = {}, rng = Math.random) {
  const seats = Array.from({ length: 4 }, (_, i) => ({
    name: i < humans ? (humans === 1 ? 'تو' : `بازیکن ${i + 1}`) : humans === 1 ? `کامپیوتر ${i}` : `کامپیوتر ${i - humans + 1}`,
    kind: i < humans ? 'human' : 'ai',
  }));
  const deck = shuffleDeck(createDeck(), rng);
  const hands = [[], [], [], []];
  let i = 0;
  for (let k = 0; k < 4; k++) {
    for (let s = 0; s < 4; s++) hands[s].push(deck[i++]);
  }
  hands.forEach((hand) => hand.sort((a, b) => b.rank - a.rank));
  const market = deck.slice(i, i + 4);
  return {
    seats,
    level,
    hands,
    market,
    piles: [[], [], [], []],
    turn: 0,
    round: 1,
    scores: [0, 0, 0, 0],
    totals: [0, 0, 0, 0],
    phase: 'play',
  };
}

export function matchingMarket(game, card) {
  return game.market.filter((item) => item.rank === card.rank);
}

export function playCard(game, seat, cardId) {
  if (game.phase !== 'play' || game.turn !== seat) return game;
  const index = game.hands[seat].findIndex((card) => card.id === cardId);
  if (index < 0) return game;
  const card = game.hands[seat][index];
  const hands = game.hands.map((hand, i) => (i === seat ? hand.filter((_, k) => k !== index) : hand));
  const matches = matchingMarket(game, card);
  let market = game.market.slice();
  const piles = game.piles.map((pile) => pile.slice());
  let captured = 0;
  if (matches.length) {
    market = market.filter((item) => item.rank !== card.rank);
    piles[seat] = [...piles[seat], card, ...matches];
    captured = matches.length;
  } else {
    market.push(card);
  }

  const next = { ...game, hands, market, piles, turn: (seat + 1) % 4, lastCapture: captured };
  if (hands.every((hand) => hand.length === 0)) {
    const scores = piles.map((pile) => pile.reduce((sum, item) => sum + cardPoints(item), 0));
    const totals = game.totals.map((value, i) => value + scores[i]);
    return { ...next, phase: 'end', roundScores: scores, totals, scores };
  }
  return next;
}

export function nextRound(game, rng = Math.random) {
  const fresh = createGame({ humans: game.seats.filter((seat) => seat.kind === 'human').length, level: game.level }, rng);
  return {
    ...fresh,
    round: game.round + 1,
    totals: game.totals,
    scores: game.totals,
  };
}

export function captureValue(cards) {
  return cards.reduce((sum, card) => sum + cardPoints(card), 0);
}

export function aiPlay(game, seat) {
  const hand = game.hands[seat];
  if (!hand.length) return null;
  let best = null;
  let bestScore = -1;
  for (const card of hand) {
    const matches = matchingMarket(game, card);
    if (!matches.length) continue;
    const score = matches.reduce((sum, item) => sum + cardPoints(item), 0) + cardPoints(card) + matches.length;
    if (score > bestScore) {
      bestScore = score;
      best = card;
    }
  }
  if (best) return best;
  return hand.reduce((low, card) => (card.rank < low.rank ? card : low));
}
