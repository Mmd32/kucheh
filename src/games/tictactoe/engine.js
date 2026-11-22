// موتور دوز: منطق خالص، بدون DOM.

export const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function createBoard() {
  return Array(9).fill('');
}

export function other(mark) {
  return mark === 'x' ? 'o' : 'x';
}

export function winner(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { mark: board[a], line: [a, b, c] };
    }
  }
  return null;
}

export function isFull(board) {
  return board.every(Boolean);
}

export function isOver(board) {
  return Boolean(winner(board)) || isFull(board);
}

export function legalMoves(board) {
  const out = [];
  for (let i = 0; i < board.length; i++) if (!board[i]) out.push(i);
  return out;
}

function negamax(board, current, me) {
  const win = winner(board);
  if (win) return win.mark === me ? 10 : -10;
  if (isFull(board)) return 0;

  const moves = legalMoves(board);
  let best = current === me ? -Infinity : Infinity;
  for (const i of moves) {
    board[i] = current;
    const value = negamax(board, other(current), me);
    board[i] = '';
    best = current === me ? Math.max(best, value) : Math.min(best, value);
  }
  return best;
}

// همه‌ی حرکت‌های بهینه (برای تنوع بین دورهای هم‌ارزش)
export function bestMoves(board, mark) {
  const moves = legalMoves(board);
  let best = -Infinity;
  let result = [];
  for (const i of moves) {
    board[i] = mark;
    const value = negamax(board, other(mark), mark);
    board[i] = '';
    if (value > best) {
      best = value;
      result = [i];
    } else if (value === best) {
      result.push(i);
    }
  }
  return result;
}
