// نقطه‌بازی: خط بکش، خانه بگیر.

export function createState(rows = 5, cols = 5) {
  return {
    rows,
    cols,
    h: Array.from({ length: rows + 1 }, () => Array(cols).fill(0)),
    v: Array.from({ length: rows }, () => Array(cols + 1).fill(0)),
    boxes: Array(rows * cols).fill(0),
    scores: [0, 0],
    turn: 0,
    moves: 0,
  };
}

export function cloneState(state) {
  return {
    rows: state.rows,
    cols: state.cols,
    h: state.h.map((row) => row.slice()),
    v: state.v.map((row) => row.slice()),
    boxes: state.boxes.slice(),
    scores: state.scores.slice(),
    turn: state.turn,
    moves: state.moves,
  };
}

export function totalEdges(state) {
  return state.rows * (state.cols + 1) + (state.rows + 1) * state.cols;
}

export function isOver(state) {
  return state.moves >= totalEdges(state);
}

export function boxComplete(state, r, c) {
  return Boolean(state.h[r][c] && state.h[r + 1][c] && state.v[r][c] && state.v[r][c + 1]);
}

function adjacentBoxes(state, edge) {
  const out = [];
  if (edge.type === 'h') {
    if (edge.r > 0) out.push([edge.r - 1, edge.c]);
    if (edge.r < state.rows) out.push([edge.r, edge.c]);
  } else {
    if (edge.c > 0) out.push([edge.r, edge.c - 1]);
    if (edge.c < state.cols) out.push([edge.r, edge.c]);
  }
  return out;
}

export function legalEdges(state) {
  const edges = [];
  for (let r = 0; r <= state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (!state.h[r][c]) edges.push({ type: 'h', r, c });
    }
  }
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c <= state.cols; c++) {
      if (!state.v[r][c]) edges.push({ type: 'v', r, c });
    }
  }
  return edges;
}

export function isEdgeFree(state, edge) {
  return edge.type === 'h' ? !state.h[edge.r][edge.c] : !state.v[edge.r][edge.c];
}

// برمی‌گرداند { state, gained } یا null اگر خط قبلاً کشیده شده باشد.
export function draw(state, edge, player = state.turn) {
  if (!isEdgeFree(state, edge)) return null;
  const next = cloneState(state);
  if (edge.type === 'h') next.h[edge.r][edge.c] = player + 1;
  else next.v[edge.r][edge.c] = player + 1;

  let gained = 0;
  for (const [br, bc] of adjacentBoxes(next, edge)) {
    const idx = br * next.cols + bc;
    if (!next.boxes[idx] && boxComplete(next, br, bc)) {
      next.boxes[idx] = player + 1;
      gained += 1;
    }
  }
  if (gained) next.scores[player] += gained;
  next.turn = gained > 0 ? player : 1 - player;
  next.moves += 1;
  return { state: next, gained };
}

function scoreDiff(state) {
  return state.scores[state.turn] - state.scores[1 - state.turn];
}

function search(state, depth, budget) {
  if (isOver(state)) return scoreDiff(state) * 100;
  if (depth <= 0 || budget.nodes <= 0) return scoreDiff(state) * 10;
  const edges = legalEdges(state).sort((a, b) => {
    // خانه‌ساز‌ها اول بررسی شوند تا هرس زودتر اتفاق بیفتد.
    const ga = draw(state, a);
    const gb = draw(state, b);
    return (gb ? gb.gained : 0) - (ga ? ga.gained : 0);
  });
  let best = -Infinity;
  for (const edge of edges) {
    budget.nodes -= 1;
    if (budget.nodes <= 0) break;
    const res = draw(state, edge);
    if (!res) continue;
    const value = res.state.turn === state.turn ? search(res.state, depth - 1, budget) : -search(res.state, depth - 1, budget);
    if (value > best) best = value;
  }
  return best === -Infinity ? scoreDiff(state) * 10 : best;
}

export function aiMove(state, difficulty = 'normal') {
  const edges = legalEdges(state);
  if (!edges.length) return null;
  if (difficulty === 'easy' && Math.random() < 0.35) {
    return edges[Math.floor(Math.random() * edges.length)];
  }
  const depth = difficulty === 'hard' ? 3 : 2;
  const budget = { nodes: difficulty === 'hard' ? 40000 : 12000 };
  let best = null;
  let bestScore = -Infinity;
  // کپی درهم برای تنوع بین حرکت‌های هم‌ارزش
  const order = edges.slice().sort(() => Math.random() - 0.5);
  for (const edge of order) {
    const res = draw(state, edge);
    if (!res) continue;
    const value = res.state.turn === state.turn ? search(res.state, depth - 1, budget) : -search(res.state, depth - 1, budget);
    if (value > bestScore) {
      bestScore = value;
      best = edge;
    }
  }
  return best || edges[0];
}
