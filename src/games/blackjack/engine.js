// بیست‌ویک: برخورد بازیکن‌ها با دلال.

import { createDeck, shuffleDeck } from '../../core/cards.js';

export function createShoe(decks = 2, rng = Math.random) {
  const shoe = [];
  let n = 0;
  for (let d = 0; d < decks; d++) {
    for (const card of createDeck()) {
      n += 1;
      shoe.push({ ...card, id: `${card.id}-${n}` });
    }
  }
  return shuffleDeck(shoe, rng);
}

export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === 14) {
      aces += 1;
      total += 1;
    } else {
      total += Math.min(10, card.rank);
    }
  }
  let soft = false;
  for (let i = 0; i < aces; i++) {
    if (total + 10 <= 21) {
      total += 10;
      soft = true;
    }
  }
  return { total, soft };
}

export function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards).total === 21;
}

const DECKS = { easy: 1, normal: 2, hard: 6 };

export function createGame({ players = 1, level = 'normal', chips = 200, rng = Math.random } = {}) {
  return {
    level,
    rng,
    shoe: createShoe(DECKS[level] || 2, rng),
    dealer: { hand: [] },
    players: Array.from({ length: players }, (_, i) => ({
      name: players === 1 ? 'تو' : `بازیکن ${i + 1}`,
      chips,
      bet: 10,
      hand: [],
      status: 'idle',
      result: null,
      delta: 0,
    })),
    phase: 'bet',
    active: 0,
    round: 0,
    dealerValue: 0,
  };
}

function draw(shoe) {
  if (!shoe.length) return { card: null, shoe };
  const [card, ...rest] = shoe;
  return { card, shoe: rest };
}

function ensureShoe(game) {
  if (game.shoe.length >= 20) return game;
  return { ...game, shoe: createShoe(DECKS[game.level] || 2) };
}

function nextActive(game, from) {
  for (let i = from; i < game.players.length; i++) {
    if (game.players[i].status === 'playing') return i;
  }
  return -1;
}

export function startRound(game) {
  const prepared = ensureShoe(game);
  const shoe = prepared.shoe.slice();
  const players = prepared.players.map((player) => {
    const hand = [];
    const first = draw(shoe);
    hand.push(first.card);
    shoe.splice(0, shoe.length, ...first.shoe);
    const second = draw(shoe);
    hand.push(second.card);
    shoe.splice(0, shoe.length, ...second.shoe);
    const bet = Math.min(player.bet, Math.max(0, player.chips));
    return { ...player, hand, bet, status: bet > 0 ? 'playing' : 'idle', result: null, delta: 0 };
  });
  const dealerHand = [];
  for (let i = 0; i < 2; i++) {
    const res = draw(shoe);
    dealerHand.push(res.card);
    shoe.splice(0, shoe.length, ...res.shoe);
  }

  const afterNaturals = players.map((player) => (isBlackjack(player.hand) ? { ...player, status: 'blackjack' } : player));
  const anyPlaying = afterNaturals.some((player) => player.status === 'playing');
  const dealerNatural = isBlackjack(dealerHand);

  return {
    ...prepared,
    shoe,
    players: afterNaturals,
    dealer: { hand: dealerHand },
    phase: anyPlaying && !dealerNatural ? 'play' : 'dealer',
    active: anyPlaying && !dealerNatural ? afterNaturals.findIndex((player) => player.status === 'playing') : -1,
    round: prepared.round + 1,
    dealerNatural,
  };
}

export function changeBet(game, index, delta) {
  const players = game.players.map((player, i) => {
    if (i !== index) return player;
    const maxBet = Math.min(50, player.chips);
    const next = Math.min(maxBet, Math.max(5, player.bet + delta));
    return { ...player, bet: next <= 0 ? 0 : next };
  });
  return { ...game, players };
}

export function hit(game) {
  if (game.phase !== 'play') return game;
  const index = game.active;
  if (index < 0) return game;
  const shoe = game.shoe.slice();
  const res = draw(shoe);
  if (!res.card) return game;
  const players = game.players.map((player, i) => (i === index ? { ...player, hand: [...player.hand, res.card] } : player));
  const value = handValue(players[index].hand);
  if (value.total > 21) {
    players[index] = { ...players[index], status: 'bust' };
    const next = nextActive({ ...game, players }, index + 1);
    return { ...game, shoe: res.shoe, players, phase: next >= 0 ? 'play' : 'dealer', active: next };
  }
  if (value.total === 21) {
    players[index] = { ...players[index], status: 'stand' };
    const next = nextActive({ ...game, players }, index + 1);
    return { ...game, shoe: res.shoe, players, phase: next >= 0 ? 'play' : 'dealer', active: next };
  }
  return { ...game, shoe: res.shoe, players };
}

export function stand(game) {
  if (game.phase !== 'play') return game;
  const index = game.active;
  const players = game.players.map((player, i) => (i === index ? { ...player, status: 'stand' } : player));
  const next = nextActive({ ...game, players }, index + 1);
  return { ...game, players, phase: next >= 0 ? 'play' : 'dealer', active: next };
}

export function double(game) {
  if (game.phase !== 'play') return game;
  const index = game.active;
  const player = game.players[index];
  if (!player || player.hand.length !== 2 || player.chips < player.bet) return game;
  const shoe = game.shoe.slice();
  const res = draw(shoe);
  if (!res.card) return game;
  const hand = [...player.hand, res.card];
  const value = handValue(hand);
  const players = game.players.map((item, i) =>
    i === index ? { ...item, hand, bet: item.bet * 2, status: value.total > 21 ? 'bust' : 'stand' } : item,
  );
  const next = nextActive({ ...game, players }, index + 1);
  return { ...game, shoe: res.shoe, players, phase: next >= 0 ? 'play' : 'dealer', active: next };
}

export function dealerTurn(game) {
  const shoe = game.shoe.slice();
  const hand = game.dealer.hand.slice();
  const hitSoft17 = game.level === 'hard';
  for (let guard = 0; guard < 12; guard++) {
    const value = handValue(hand);
    const shouldHit = value.total < 17 || (value.total === 17 && value.soft && hitSoft17);
    if (!shouldHit) break;
    const res = draw(shoe);
    if (!res.card) break;
    hand.push(res.card);
    shoe.splice(0, shoe.length, ...res.shoe);
  }
  return settle({ ...game, shoe, dealer: { hand }, dealerValue: handValue(hand).total });
}

function settle(game) {
  const dealer = handValue(game.dealer.hand);
  const dealerBlackjack = isBlackjack(game.dealer.hand);
  const players = game.players.map((player) => {
    if (!player.hand.length) return { ...player, status: 'idle', result: null, delta: 0 };
    const value = handValue(player.hand);
    const blackjack = isBlackjack(player.hand);
    let result = 'push';
    let delta = 0;
    if (value.total > 21) {
      result = 'bust';
      delta = -player.bet;
    } else if (blackjack && !dealerBlackjack) {
      result = 'blackjack';
      delta = Math.round(player.bet * 1.5);
    } else if (dealerBlackjack) {
      result = blackjack ? 'push' : 'lose';
      delta = blackjack ? 0 : -player.bet;
    } else if (dealer.total > 21) {
      result = 'win';
      delta = player.bet;
    } else if (value.total > dealer.total) {
      result = 'win';
      delta = player.bet;
    } else if (value.total < dealer.total) {
      result = 'lose';
      delta = -player.bet;
    }
    return { ...player, status: 'done', result, delta, chips: player.chips + delta };
  });
  return { ...game, players, phase: 'settle', active: -1, dealerValue: dealer.total };
}

export function nextRound(game) {
  return {
    ...game,
    phase: 'bet',
    dealer: { hand: [] },
    players: game.players.map((player) => ({ ...player, hand: [], status: 'idle', result: null, delta: 0 })),
    active: 0,
  };
}

export function payoutLabel(result) {
  switch (result) {
    case 'blackjack':
      return 'بلک‌جک';
    case 'win':
      return 'برد';
    case 'lose':
      return 'باخت';
    case 'bust':
      return 'سوخت';
    case 'push':
      return 'مساوی';
    default:
      return '';
  }
}
