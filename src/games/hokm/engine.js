// حکم: چهار نفره، دو تیم، ۱۳ دست در هر دور.

import { createDeck, shuffleDeck } from '../../core/cards.js';

export const SUITS = ['S', 'H', 'D', 'C'];
export const TEAM = (seat) => seat % 2;
export const SEAT_NAMES = ['شمال', 'شرق', 'جنوب', 'غرب'];

export function createMatch({ humans = 1, level = 'normal' } = {}) {
  const seats = Array.from({ length: 4 }, (_, i) => ({
    name: i < humans ? (humans === 1 ? 'تو' : `بازیکن ${i + 1}`) : humans === 1 ? `کامپیوتر ${i}` : `کامپیوتر ${i - humans + 1}`,
    kind: i < humans ? 'human' : 'ai',
  }));
  return {
    seats,
    level,
    hands: [[], [], [], []],
    deck: [],
    trump: null,
    hakem: 0,
    turn: 0,
    leader: 0,
    trick: [],
    tricks: [0, 0, 0, 0],
    teamTricks: [0, 0],
    phase: 'idle',
    scores: [0, 0],
    lastTrick: null,
    round: 0,
  };
}

export function dealFive(match, rng = Math.random) {
  const deck = shuffleDeck(createDeck(), rng);
  const hands = [[], [], [], []];
  let i = 0;
  for (let k = 0; k < 5; k++) {
    for (let s = 0; s < 4; s++) hands[s].push(deck[i++]);
  }
  return {
    ...match,
    hands,
    deck: deck.slice(i),
    trump: null,
    phase: 'trump',
    turn: match.hakem,
    leader: match.hakem,
    trick: [],
    tricks: [0, 0, 0, 0],
    teamTricks: [0, 0],
    lastTrick: null,
    round: match.round + 1,
  };
}

export function chooseTrump(match, suit) {
  const hands = match.hands.map((hand) => hand.slice());
  const deck = match.deck.slice();
  let i = 0;
  for (let k = 0; k < 8; k++) {
    for (let s = 0; s < 4; s++) hands[s].push(deck[i++]);
  }
  for (const hand of hands) hand.sort((a, b) => a.rank - b.rank);
  return { ...match, hands, deck: [], trump: suit, phase: 'play', turn: match.hakem, leader: match.hakem };
}

export function legalCards(match, seat) {
  const hand = match.hands[seat] || [];
  if (!hand.length) return [];
  if (!match.trick.length) return hand;
  const led = match.trick[0].card.suit;
  const follow = hand.filter((card) => card.suit === led);
  return follow.length ? follow : hand;
}

export function trickWinner(match) {
  if (!match.trick.length) return null;
  const led = match.trick[0].card.suit;
  const trumps = match.trick.filter((play) => play.card.suit === match.trump);
  const pool = trumps.length ? trumps : match.trick.filter((play) => play.card.suit === led);
  return pool.reduce((best, play) => (play.card.rank > best.card.rank ? play : best));
}

export function playCard(match, seat, cardId) {
  if (match.phase !== 'play' || match.turn !== seat) return match;
  const hand = match.hands[seat];
  const index = hand.findIndex((card) => card.id === cardId);
  if (index < 0) return match;
  const card = hand[index];
  const legal = legalCards(match, seat);
  if (!legal.some((item) => item.id === cardId)) return match;

  const hands = match.hands.map((list, i) => (i === seat ? list.filter((_, k) => k !== index) : list));
  const trick = [...match.trick, { seat, card }];

  if (trick.length < 4) {
    return { ...match, hands, trick, turn: (seat + 1) % 4 };
  }

  const provisional = { ...match, hands, trick };
  const winner = trickWinner(provisional);
  const tricks = match.tricks.slice();
  tricks[winner.seat] += 1;
  const teamTricks = [0, 0];
  for (let s = 0; s < 4; s++) teamTricks[TEAM(s)] += tricks[s];

  const done = hands.every((list) => list.length === 0);
  if (!done) {
    return {
      ...match,
      hands,
      trick: [],
      tricks,
      teamTricks,
      turn: winner.seat,
      leader: winner.seat,
      lastTrick: trick,
    };
  }

  const winnerTeam = teamTricks[0] >= 7 ? 0 : 1;
  const scores = match.scores.slice();
  scores[winnerTeam] += 1;
  const matchEnd = scores[winnerTeam] >= 2;
  const hakem = winnerTeam === TEAM(match.hakem) ? match.hakem : (match.hakem + 1) % 4;
  return {
    ...match,
    hands,
    trick: [],
    tricks,
    teamTricks,
    lastTrick: trick,
    phase: matchEnd ? 'matchEnd' : 'roundEnd',
    scores,
    hakem,
    roundWinner: winnerTeam,
  };
}

export function startNextRound(match, rng = Math.random) {
  return dealFive({ ...match, phase: 'idle' }, rng);
}
