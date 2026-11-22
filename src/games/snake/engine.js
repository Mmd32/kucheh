// مار بازی: منطق شبکه‌ای، بدون DOM.

export const SPEEDS = { easy: 190, medium: 135, hard: 95 };

export const DIRECTIONS = {
  up: { dr: -1, dc: 0, opposite: 'down' },
  down: { dr: 1, dc: 0, opposite: 'up' },
  left: { dr: 0, dc: -1, opposite: 'right' },
  right: { dr: 0, dc: 1, opposite: 'left' },
};

function freeCell(state, rng) {
  const taken = new Set([...state.snake, ...state.walls]);
  const pool = [];
  for (let i = 0; i < state.cols * state.rows; i++) if (!taken.has(i)) pool.push(i);
  if (!pool.length) return -1;
  return pool[Math.floor(rng() * pool.length)];
}

export function createState({ cols = 17, rows = 17, walls = 0, rng = Math.random } = {}) {
  const midRow = Math.floor(rows / 2);
  const midCol = Math.max(3, Math.floor(cols / 2));
  const head = midRow * cols + midCol;
  const state = {
    cols,
    rows,
    snake: [head, head - 1, head - 2],
    dir: 'right',
    nextDir: 'right',
    score: 0,
    dead: false,
    walls: [],
    food: -1,
  };
  for (let i = 0; i < walls; i++) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const cell = freeCell(state, rng);
      if (cell < 0) break;
      const r = Math.floor(cell / cols);
      const c = cell % cols;
      if (r < 2 || r > rows - 3 || c < 3 || c > cols - 3) continue;
      state.walls.push(cell);
      break;
    }
  }
  state.food = freeCell(state, rng);
  return state;
}

export function turn(state, dir) {
  if (!DIRECTIONS[dir]) return state;
  if (DIRECTIONS[dir].opposite === state.dir) return state;
  return { ...state, nextDir: dir };
}

export function step(state, rng = Math.random) {
  if (state.dead) return state;
  const dir = state.nextDir;
  const { dr, dc } = DIRECTIONS[dir];
  const head = state.snake[0];
  const r = Math.floor(head / state.cols) + dr;
  const c = (head % state.cols) + dc;
  if (r < 0 || r >= state.rows || c < 0 || c >= state.cols) {
    return { ...state, dir, dead: true };
  }
  const next = r * state.cols + c;
  if (state.walls.includes(next)) return { ...state, dir, dead: true };
  const willGrow = next === state.food;
  const body = willGrow ? state.snake : state.snake.slice(0, -1);
  if (body.includes(next)) return { ...state, dir, dead: true };
  const snake = [next, ...body];
  const updated = {
    ...state,
    dir,
    snake,
    score: willGrow ? state.score + 1 : state.score,
    food: willGrow ? freeCell({ ...state, snake }, rng) : state.food,
  };
  return updated;
}
