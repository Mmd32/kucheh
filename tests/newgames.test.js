import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, createGame, placeMines, reveal, toggleFlag, neighbors } from '../src/games/minesweeper/engine.js';
import { createPuzzle, waterCells, isSolved, rotateCell } from '../src/games/pipes/engine.js';
import { createState, turn, step, DIRECTIONS } from '../src/games/snake/engine.js';
import { PARKING_LEVELS } from '../src/data/parking-levels.js';
import { fromLayout, canSlide, slide, isSolved as parkingSolved, solveMin } from '../src/games/parking/engine.js';
import { createMatch, dealFive, chooseTrump, playCard, legalCards, SUITS } from '../src/games/hokm/engine.js';
import { aiPlay as hokmAiPlay } from '../src/games/hokm/ai.js';
import { createGame as createChahar, playCard as chaharPlay, aiPlay as chaharAi } from '../src/games/chaharbarg/engine.js';
import { createGame as createBlackjack, startRound, handValue, hit, stand, dealerTurn, changeBet } from '../src/games/blackjack/engine.js';
import { createGame as createBilliards, shoot, step as billiardStep, isMoving, remainingObjects } from '../src/games/billiards/engine.js';

test('مین‌روب: اولین کلیک امن است و تعداد مین‌ها درست', () => {
  const start = placeMines(createGame(PRESETS.easy.rows, PRESETS.easy.cols, PRESETS.easy.mines), 40);
  assert.equal(start.cells.filter((cell) => cell.mine).length, PRESETS.easy.mines);
  for (const n of [40, ...neighbors(40, 9, 9)]) {
    assert.equal(start.cells[n].mine, false, `خانه ${n}`);
  }
  const opened = reveal(start, 40);
  assert.equal(opened.over, false);
  assert.ok(opened.cells[40].revealed);
  const flagged = toggleFlag(start, 0);
  assert.ok(flagged.cells[0].flagged);
  assert.equal(toggleFlag(flagged, 0).cells[0].flagged, false);
});

test('لوله‌کشی: جدول با پاسخ ذخیره‌شده حل می‌شود', () => {
  for (let i = 0; i < 5; i++) {
    const puzzle = createPuzzle(5);
    assert.equal(puzzle.base.filter(Boolean).length > 0, true);
    const solved = { ...puzzle, rot: Uint8Array.from(puzzle.solution) };
    assert.equal(isSolved(solved), true);
    assert.equal(puzzle.source < puzzle.size, true, 'شیر در ردیف بالا');
    assert.equal(isSolved(puzzle), false);
    assert.ok(waterCells(puzzle).size >= 1);
    const rotated = rotateCell(puzzle, 0);
    assert.equal(rotated.rot[0], (puzzle.rot[0] + 1) % 4);
  }
});

test('مار بازی: حرکت، غذا و مرگ', () => {
  let state = createState({ cols: 9, rows: 9, walls: 0 });
  const head = state.snake[0];
  state = turn(state, 'up');
  state = step(state);
  assert.equal(state.snake[0], head - 9);
  assert.equal(state.dead, false);

  const eat = { ...createState({ cols: 9, rows: 9, walls: 0 }), food: 31 };
  const grown = step(turn(eat, 'up'));
  assert.equal(grown.score, 1);
  assert.equal(grown.snake.length, 4);

  const edge = { ...createState({ cols: 9, rows: 9, walls: 0 }), snake: [4, 3, 2], dir: 'up', nextDir: 'up', food: 70 };
  assert.equal(step(edge).dead, true);
  assert.ok(DIRECTIONS.up);
});

test('پارکینگ: همه‌ی مرحله‌ها با کمترین حرکت داده‌شده حل می‌شوند', () => {
  for (const [level, puzzles] of Object.entries(PARKING_LEVELS)) {
    assert.ok(puzzles.length >= 3, level);
    for (const puzzle of puzzles.slice(0, 3)) {
      const state = fromLayout(puzzle.layout);
      assert.equal(parkingSolved(state), false, `${level} از قبل حل شده`);
      assert.equal(solveMin(state, { maxNodes: 120000 }), puzzle.min, `${level}: ${puzzle.min}`);
    }
  }
});

test('حکم: پخش، تعیین حکم و یک دور کامل', () => {
  let match = dealFive(createMatch({ humans: 1 }));
  assert.equal(match.phase, 'trump');
  for (const hand of match.hands) assert.equal(hand.length, 5);
  match = chooseTrump(match, 'S');
  assert.equal(match.phase, 'play');
  for (const hand of match.hands) assert.equal(hand.length, 13);

  let guard = 0;
  while (match.phase === 'play' && guard < 60) {
    guard += 1;
    const legal = legalCards(match, match.turn);
    assert.ok(legal.length > 0);
    const card = hokmAiPlay(match, match.turn) || legal[0];
    match = playCard(match, match.turn, card.id);
  }
  assert.equal(match.phase, 'roundEnd');
  const total = match.tricks.reduce((a, b) => a + b, 0);
  assert.equal(total, 13);
  assert.ok(match.teamTricks[0] + match.teamTricks[1] === 13);
  assert.ok(SUITS.includes(match.trump));
});

test('چهار برگ: بازی تا خالی شدن دست‌ها و جمع امتیاز', () => {
  let game = createChahar({ humans: 1 });
  assert.equal(game.hands.every((hand) => hand.length === 4), true);
  assert.equal(game.market.length, 4);
  let guard = 0;
  while (game.phase === 'play' && guard < 40) {
    guard += 1;
    const card = chaharAi(game, game.turn);
    assert.ok(card);
    game = chaharPlay(game, game.turn, card.id);
  }
  assert.equal(game.phase, 'end');
  assert.equal(game.hands.every((hand) => hand.length === 0), true);
  assert.ok(game.totals.every((value) => value >= 0));
});

test('بیست‌ویک: ارزش دست و یک دور ساده', () => {
  const card = (rank) => ({ id: `S${rank}`, suit: 'S', rank });
  assert.equal(handValue([card(14), card(13)]).total, 21);
  assert.equal(handValue([card(14), card(14), card(9)]).total, 21);
  assert.equal(handValue([card(10), card(9), card(5)]).total, 24);

  let game = createBlackjack({ players: 2, rng: () => 0.3 });
  game = startRound(game);
  assert.equal(game.players.length, 2);
  for (const player of game.players) assert.equal(player.hand.length, 2);
  assert.equal(game.dealer.hand.length, 2);
  game = { ...game, phase: 'play', active: 0 };
  game = hit(game);
  game = stand(game);
  if (game.phase === 'play') game = stand(game);
  if (game.phase === 'dealer') game = dealerTurn(game);
  assert.equal(game.phase, 'settle');
  assert.ok(game.players.every((player) => ['done', 'blackjack'].includes(player.status) || player.status === 'bust'));
});

test('بیلیارد: ضربه و حرکت توپ‌ها', () => {
  const start = createBilliards({ count: 7 });
  assert.equal(remainingObjects(start), 7);
  const shot = shoot(start, 0, 0.6);
  let state = shot;
  let guard = 0;
  while (isMoving(state) && guard < 3000) {
    state = billiardStep(state).state;
    guard += 1;
  }
  assert.equal(isMoving(state), false);
  for (const ball of state.balls) {
    assert.ok(ball.x >= 0 && ball.x <= 1000);
    assert.ok(ball.y >= 0 && ball.y <= 500);
  }
});

test('بیست‌ویک: شرط با سکه‌ی صفر صفر می‌ماند', () => {
  let game = createBlackjack({ players: 1, level: 'normal' });
  game = { ...game, players: game.players.map((player) => ({ ...player, chips: 0, bet: 10 })) };
  game = changeBet(game, 0, 5);
  assert.equal(game.players[0].bet, 0);
  game = changeBet(game, 0, -5);
  assert.equal(game.players[0].bet, 0);
});
