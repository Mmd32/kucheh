// شطرنج: تولید حرکت، قواعد کامل و ارزیابی FEN.

export const WHITE = 'w';
export const BLACK = 'b';
export const FILES = 'abcdefgh';

const KNIGHT_DELTAS = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];

const KING_DELTAS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

const ORTHOGONAL = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const DIAGONAL = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

const ALL_DIRS = [...ORTHOGONAL, ...DIAGONAL];

export const rowOf = (i) => i >> 3;
export const colOf = (i) => i & 7;
export const sq = (r, c) => (r << 3) | c;
export const inBoard = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
export const colorOf = (p) => (p === p.toUpperCase() ? WHITE : BLACK);
export const opposite = (color) => (color === WHITE ? BLACK : WHITE);

export function squareName(i) {
  return `${FILES[colOf(i)]}${8 - rowOf(i)}`;
}

export function createInitialState() {
  const board = Array(64).fill(null);
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let c = 0; c < 8; c++) {
    board[c] = back[c];
    board[8 + c] = 'p';
    board[48 + c] = 'P';
    board[56 + c] = back[c].toUpperCase();
  }
  return {
    board,
    turn: WHITE,
    castling: { w: { k: true, q: true }, b: { k: true, q: true } },
    ep: null,
    halfmove: 0,
    fullmove: 1,
  };
}

export function cloneState(state) {
  return {
    board: state.board.slice(),
    turn: state.turn,
    castling: { w: { ...state.castling.w }, b: { ...state.castling.b } },
    ep: state.ep,
    halfmove: state.halfmove,
    fullmove: state.fullmove,
  };
}

export function isAttacked(board, target, by) {
  const r0 = rowOf(target);
  const c0 = colOf(target);

  const pawnRow = by === WHITE ? r0 + 1 : r0 - 1;
  for (const dc of [-1, 1]) {
    const c = c0 + dc;
    if (inBoard(pawnRow, c) && board[sq(pawnRow, c)] === (by === WHITE ? 'P' : 'p')) return true;
  }

  for (const [dr, dc] of KNIGHT_DELTAS) {
    const r = r0 + dr;
    const c = c0 + dc;
    if (inBoard(r, c) && board[sq(r, c)] === (by === WHITE ? 'N' : 'n')) return true;
  }

  for (const [dr, dc] of KING_DELTAS) {
    const r = r0 + dr;
    const c = c0 + dc;
    if (inBoard(r, c) && board[sq(r, c)] === (by === WHITE ? 'K' : 'k')) return true;
  }

  for (const [dr, dc] of ORTHOGONAL) {
    let r = r0 + dr;
    let c = c0 + dc;
    while (inBoard(r, c)) {
      const p = board[sq(r, c)];
      if (p) {
        if (colorOf(p) === by && (p.toLowerCase() === 'r' || p.toLowerCase() === 'q')) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }

  for (const [dr, dc] of DIAGONAL) {
    let r = r0 + dr;
    let c = c0 + dc;
    while (inBoard(r, c)) {
      const p = board[sq(r, c)];
      if (p) {
        if (colorOf(p) === by && (p.toLowerCase() === 'b' || p.toLowerCase() === 'q')) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }

  return false;
}

function addPawnMove(moves, from, to, piece, captured, promoRow, color) {
  if (rowOf(to) === promoRow) {
    for (const promo of ['q', 'r', 'b', 'n']) {
      moves.push({
        from,
        to,
        piece,
        captured,
        promotion: color === WHITE ? promo.toUpperCase() : promo,
        flags: {},
      });
    }
  } else {
    moves.push({ from, to, piece, captured, promotion: null, flags: {} });
  }
}

export function pseudoMoves(state, color = state.turn) {
  const { board } = state;
  const moves = [];

  for (let from = 0; from < 64; from++) {
    const piece = board[from];
    if (!piece || colorOf(piece) !== color) continue;
    const type = piece.toLowerCase();
    const r0 = rowOf(from);
    const c0 = colOf(from);

    if (type === 'p') {
      const dir = color === WHITE ? -8 : 8;
      const startRow = color === WHITE ? 6 : 1;
      const promoRow = color === WHITE ? 0 : 7;
      const one = from + dir;

      if (inBoard(rowOf(one), colOf(one)) && !board[one]) {
        addPawnMove(moves, from, one, piece, null, promoRow, color);
        const two = from + dir * 2;
        if (r0 === startRow && !board[two]) {
          moves.push({ from, to: two, piece, captured: null, promotion: null, flags: { double: true } });
        }
      }

      for (const dc of [-1, 1]) {
        const c1 = c0 + dc;
        const r1 = r0 + (color === WHITE ? -1 : 1);
        if (!inBoard(r1, c1)) continue;
        const to = sq(r1, c1);
        const target = board[to];
        if (target && colorOf(target) !== color) {
          addPawnMove(moves, from, to, piece, target, promoRow, color);
        } else if (state.ep === to) {
          moves.push({ from, to, piece, captured: color === WHITE ? 'p' : 'P', promotion: null, flags: { ep: true } });
        }
      }
      continue;
    }

    if (type === 'n' || type === 'k') {
      const deltas = type === 'n' ? KNIGHT_DELTAS : KING_DELTAS;
      for (const [dr, dc] of deltas) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (!inBoard(r, c)) continue;
        const to = sq(r, c);
        const target = board[to];
        if (target && colorOf(target) === color) continue;
        moves.push({ from, to, piece, captured: target || null, promotion: null, flags: {} });
      }
    } else {
      const dirs = type === 'b' ? DIAGONAL : type === 'r' ? ORTHOGONAL : ALL_DIRS;
      for (const [dr, dc] of dirs) {
        let r = r0 + dr;
        let c = c0 + dc;
        while (inBoard(r, c)) {
          const to = sq(r, c);
          const target = board[to];
          if (!target) {
            moves.push({ from, to, piece, captured: null, promotion: null, flags: {} });
          } else {
            if (colorOf(target) !== color) {
              moves.push({ from, to, piece, captured: target, promotion: null, flags: {} });
            }
            break;
          }
          r += dr;
          c += dc;
        }
      }
    }

    if (type === 'k') {
      const rights = state.castling[color];
      const homeRow = color === WHITE ? 7 : 0;
      const kingFrom = sq(homeRow, 4);
      const rook = color === WHITE ? 'R' : 'r';
      if (from === kingFrom && !isAttacked(board, kingFrom, opposite(color))) {
        if (
          rights.k &&
          !board[sq(homeRow, 5)] &&
          !board[sq(homeRow, 6)] &&
          board[sq(homeRow, 7)] === rook &&
          !isAttacked(board, sq(homeRow, 5), opposite(color)) &&
          !isAttacked(board, sq(homeRow, 6), opposite(color))
        ) {
          moves.push({ from, to: sq(homeRow, 6), piece, captured: null, promotion: null, flags: { castle: 'k' } });
        }
        if (
          rights.q &&
          !board[sq(homeRow, 3)] &&
          !board[sq(homeRow, 2)] &&
          !board[sq(homeRow, 1)] &&
          board[sq(homeRow, 0)] === rook &&
          !isAttacked(board, sq(homeRow, 3), opposite(color)) &&
          !isAttacked(board, sq(homeRow, 2), opposite(color))
        ) {
          moves.push({ from, to: sq(homeRow, 2), piece, captured: null, promotion: null, flags: { castle: 'q' } });
        }
      }
    }
  }

  return moves;
}

const ROOK_SQUARES = {
  56: ['w', 'q'],
  63: ['w', 'k'],
  0: ['b', 'q'],
  7: ['b', 'k'],
};

export function makeMove(state, move) {
  const board = state.board.slice();
  const color = state.turn;

  board[move.from] = null;

  if (move.flags && move.flags.ep) {
    board[move.to + (color === WHITE ? 8 : -8)] = null;
  }

  board[move.to] = move.promotion || move.piece;

  if (move.flags && move.flags.castle === 'k') {
    const rf = color === WHITE ? 63 : 7;
    const rt = color === WHITE ? 61 : 5;
    board[rt] = board[rf];
    board[rf] = null;
  }
  if (move.flags && move.flags.castle === 'q') {
    const rf = color === WHITE ? 56 : 0;
    const rt = color === WHITE ? 59 : 3;
    board[rt] = board[rf];
    board[rf] = null;
  }

  const castling = { w: { ...state.castling.w }, b: { ...state.castling.b } };
  const type = move.piece.toLowerCase();
  if (type === 'k') {
    castling[color].k = false;
    castling[color].q = false;
  }
  if (ROOK_SQUARES[move.from]) {
    const [side, which] = ROOK_SQUARES[move.from];
    castling[side][which] = false;
  }
  if (ROOK_SQUARES[move.to]) {
    const [side, which] = ROOK_SQUARES[move.to];
    castling[side][which] = false;
  }

  const ep = type === 'p' && Math.abs(move.to - move.from) === 16 ? move.from + (color === WHITE ? -8 : 8) : null;
  const halfmove = type === 'p' || move.captured ? 0 : state.halfmove + 1;

  return {
    board,
    turn: opposite(color),
    castling,
    ep,
    halfmove,
    fullmove: state.fullmove + (color === BLACK ? 1 : 0),
  };
}

export function legalMoves(state, color = state.turn) {
  const kingPiece = color === WHITE ? 'K' : 'k';
  const out = [];
  for (const move of pseudoMoves(state, color)) {
    const next = makeMove(state, move);
    const king = next.board.indexOf(kingPiece);
    if (king < 0) continue;
    if (!isAttacked(next.board, king, opposite(color))) out.push(move);
  }
  return out;
}

export function isInCheck(state, color = state.turn) {
  const king = state.board.indexOf(color === WHITE ? 'K' : 'k');
  return king >= 0 && isAttacked(state.board, king, opposite(color));
}

export function gameStatus(state) {
  const moves = legalMoves(state);
  const check = isInCheck(state);
  if (!moves.length) return check ? 'checkmate' : 'stalemate';
  if (state.halfmove >= 100) return 'fifty';
  if (insufficientMaterial(state.board)) return 'material';
  return check ? 'check' : 'ok';
}

export function insufficientMaterial(board) {
  const pieces = board.filter(Boolean).map((p) => p.toLowerCase());
  const nonKings = pieces.filter((p) => p !== 'k');
  if (nonKings.length === 0) return true;
  if (nonKings.length === 1 && (nonKings[0] === 'n' || nonKings[0] === 'b')) return true;
  if (nonKings.length === 2 && nonKings.every((p) => p === 'b')) return true;
  return false;
}

export function toFen(state) {
  let placement = '';
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = state.board[sq(r, c)];
      if (!p) empty += 1;
      else {
        if (empty) {
          placement += empty;
          empty = 0;
        }
        placement += p;
      }
    }
    if (empty) placement += empty;
    if (r < 7) placement += '/';
  }
  const castling =
    `${state.castling.w.k ? 'K' : ''}${state.castling.w.q ? 'Q' : ''}${state.castling.b.k ? 'k' : ''}${state.castling.b.q ? 'q' : ''}` || '-';
  const ep = state.ep == null ? '-' : `${FILES[colOf(state.ep)]}${8 - rowOf(state.ep)}`;
  return `${placement} ${state.turn} ${castling} ${ep} ${state.halfmove} ${state.fullmove}`;
}

export function fromFen(fen) {
  const parts = String(fen).trim().split(/\s+/);
  const placement = parts[0];
  const board = Array(64).fill(null);
  let i = 0;
  for (const ch of placement) {
    if (ch === '/') continue;
    if (/\d/.test(ch)) {
      i += Number(ch);
      continue;
    }
    board[i] = ch;
    i += 1;
  }
  const castling = parts[2] || '-';
  const ep = parts[3] || '-';
  return {
    board,
    turn: parts[1] || 'w',
    castling: { w: { k: castling.includes('K'), q: castling.includes('Q') }, b: { k: castling.includes('k'), q: castling.includes('q') } },
    ep: ep === '-' ? null : sq(8 - Number(ep.slice(1)), FILES.indexOf(ep[0])),
    halfmove: Number(parts[4] || 0),
    fullmove: Number(parts[5] || 1),
  };
}

export function positionKey(state) {
  return toFen(state).split(' ').slice(0, 4).join(' ');
}

export function toSan(state, move, legal = legalMoves(state)) {
  if (move.flags && move.flags.castle) return move.flags.castle === 'k' ? 'O-O' : 'O-O-O';

  const type = move.piece.toLowerCase();
  let san = '';

  if (type === 'p') {
    if (move.captured) san += FILES[colOf(move.from)] + 'x';
    san += squareName(move.to);
    if (move.promotion) san += '=' + move.promotion.toUpperCase();
  } else {
    san += type.toUpperCase();
    const rivals = legal.filter(
      (m) => m.to === move.to && m.from !== move.from && m.piece.toLowerCase() === type && colorOf(m.piece) === colorOf(move.piece),
    );
    if (rivals.length) {
      const sameFile = rivals.some((m) => colOf(m.from) === colOf(move.from));
      const sameRank = rivals.some((m) => rowOf(m.from) === rowOf(move.from));
      if (!sameFile) san += FILES[colOf(move.from)];
      else if (!sameRank) san += String(8 - rowOf(move.from));
      else san += squareName(move.from);
    }
    if (move.captured) san += 'x';
    san += squareName(move.to);
  }

  const next = makeMove(state, move);
  if (isInCheck(next, next.turn)) san += legalMoves(next, next.turn).length ? '+' : '#';
  return san;
}

export function perft(state, depth) {
  if (depth === 0) return 1;
  const moves = legalMoves(state);
  if (depth === 1) return moves.length;
  let total = 0;
  for (const move of moves) total += perft(makeMove(state, move), depth - 1);
  return total;
}
