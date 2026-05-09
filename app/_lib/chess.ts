// ======================================================
// -------- 0. TYPES & CONSTANTS ------------------------
// ======================================================
//
// Standard chess rules engine. Keep it pure — no React,
// no DOM, no I/O. The board is row-major and `rank 0`
// is the TOP of the board (i.e. FEN row 0 = chess rank 8,
// where black's back rank lives).

export type Color = 'w' | 'b'
export type Square = [number, number]  // [rank 0..7, file 0..7]

export interface State {
  board: string[][]              // '' = empty; uppercase = white piece
  turn: Color
  castling: string               // any of "KQkq", or "-"
  enPassant: Square | null       // square that can be captured en-passant
  halfmove: number               // 50-move-rule counter
  fullmove: number
}

export const START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

// ======================================================
// -------- 1. FEN PARSE --------------------------------
// ======================================================

export function parseFen(fen: string): State {
  const [pos, turn, castling, ep, half, full] = fen.split(' ')
  const board: string[][] = pos.split('/').map((row) => {
    const out: string[] = []
    for (const ch of row) {
      if (/\d/.test(ch)) out.push(...Array(parseInt(ch)).fill(''))
      else out.push(ch)
    }
    return out
  })
  return {
    board,
    turn: turn as Color,
    castling,
    enPassant: ep === '-' ? null : algebraicToSquare(ep),
    halfmove: parseInt(half),
    fullmove: parseInt(full),
  }
}

function algebraicToSquare(a: string): Square {
  return [8 - parseInt(a[1]), a.charCodeAt(0) - 97]
}

// ======================================================
// -------- 2. PIECE HELPERS ----------------------------
// ======================================================

export function colorOf(piece: string): Color | null {
  if (!piece) return null
  return piece === piece.toUpperCase() ? 'w' : 'b'
}

const inBounds = ([r, f]: Square) => r >= 0 && r < 8 && f >= 0 && f < 8
const opposite = (c: Color): Color => (c === 'w' ? 'b' : 'w')

// ======================================================
// -------- 3. PSEUDO-LEGAL MOVE GENERATORS -------------
// ======================================================
//
// "Pseudo-legal" = moves that respect piece geometry but
// MAY leave own king in check. The check-filter happens
// later in `legalMoves`.

const KNIGHT_DELTAS: Square[] = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]
const KING_DELTAS:   Square[] = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]
const BISHOP_DIRS:   Square[] = [[-1,-1],[-1,1],[1,-1],[1,1]]
const ROOK_DIRS:     Square[] = [[-1,0],[1,0],[0,-1],[0,1]]

function slideMoves(s: State, from: Square, dirs: Square[], me: Color): Square[] {
  const out: Square[] = []
  for (const [dr, df] of dirs) {
    let r = from[0], f = from[1]
    while (true) {
      r += dr; f += df
      if (!inBounds([r, f])) break
      const piece = s.board[r][f]
      if (!piece) { out.push([r, f]); continue }
      if (colorOf(piece) !== me) out.push([r, f])
      break
    }
  }
  return out
}

function stepMoves(s: State, from: Square, deltas: Square[], me: Color): Square[] {
  const out: Square[] = []
  for (const [dr, df] of deltas) {
    const to: Square = [from[0] + dr, from[1] + df]
    if (!inBounds(to)) continue
    if (colorOf(s.board[to[0]][to[1]]) === me) continue
    out.push(to)
  }
  return out
}

function pawnMoves(s: State, from: Square, me: Color): Square[] {
  const [r, f] = from
  const dir = me === 'w' ? -1 : 1
  const startRank = me === 'w' ? 6 : 1
  const out: Square[] = []
  // single push
  if (inBounds([r + dir, f]) && !s.board[r + dir][f]) {
    out.push([r + dir, f])
    // double push from start rank
    if (r === startRank && !s.board[r + 2 * dir][f]) out.push([r + 2 * dir, f])
  }
  // captures (incl. en-passant)
  for (const df of [-1, 1]) {
    const to: Square = [r + dir, f + df]
    if (!inBounds(to)) continue
    const target = s.board[to[0]][to[1]]
    if (target && colorOf(target) !== me) out.push(to)
    if (s.enPassant && s.enPassant[0] === to[0] && s.enPassant[1] === to[1]) out.push(to)
  }
  return out
}

function castlingMoves(s: State, from: Square, me: Color): Square[] {
  const rank = me === 'w' ? 7 : 0
  if (from[0] !== rank || from[1] !== 4) return []
  const [kSide, qSide] = me === 'w' ? ['K', 'Q'] : ['k', 'q']
  const enemy = opposite(me)
  const out: Square[] = []
  if (s.castling.includes(kSide) &&
      !s.board[rank][5] && !s.board[rank][6] &&
      !isAttacked(s, [rank, 4], enemy) &&
      !isAttacked(s, [rank, 5], enemy) &&
      !isAttacked(s, [rank, 6], enemy)) {
    out.push([rank, 6])
  }
  if (s.castling.includes(qSide) &&
      !s.board[rank][1] && !s.board[rank][2] && !s.board[rank][3] &&
      !isAttacked(s, [rank, 4], enemy) &&
      !isAttacked(s, [rank, 3], enemy) &&
      !isAttacked(s, [rank, 2], enemy)) {
    out.push([rank, 2])
  }
  return out
}

export function pseudoLegalMoves(s: State, from: Square): Square[] {
  const piece = s.board[from[0]][from[1]]
  if (!piece) return []
  const me = colorOf(piece)!
  switch (piece.toLowerCase()) {
    case 'p': return pawnMoves(s, from, me)
    case 'n': return stepMoves(s, from, KNIGHT_DELTAS, me)
    case 'b': return slideMoves(s, from, BISHOP_DIRS, me)
    case 'r': return slideMoves(s, from, ROOK_DIRS, me)
    case 'q': return [...slideMoves(s, from, BISHOP_DIRS, me), ...slideMoves(s, from, ROOK_DIRS, me)]
    case 'k': return [...stepMoves(s, from, KING_DELTAS, me), ...castlingMoves(s, from, me)]
    default:  return []
  }
}

// ======================================================
// -------- 4. CHECK / ATTACK DETECTION -----------------
// ======================================================

function findKing(s: State, me: Color): Square | null {
  const target = me === 'w' ? 'K' : 'k'
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++)
      if (s.board[r][f] === target) return [r, f]
  return null
}

// Asks: can color `by` attack `sq`? Pawn attacks differ
// from pawn moves (diagonals only), so pawns get a
// special-case here. No castling — castling can't deliver
// attack, and including it would recurse forever.
function isAttacked(s: State, sq: Square, by: Color): boolean {
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = s.board[r][f]
      if (!piece || colorOf(piece) !== by) continue
      let moves: Square[]
      switch (piece.toLowerCase()) {
        case 'p': {
          const dir = by === 'w' ? -1 : 1
          moves = ([[r + dir, f - 1], [r + dir, f + 1]] as Square[]).filter(inBounds)
          break
        }
        case 'n': moves = stepMoves(s, [r, f], KNIGHT_DELTAS, by); break
        case 'b': moves = slideMoves(s, [r, f], BISHOP_DIRS, by); break
        case 'r': moves = slideMoves(s, [r, f], ROOK_DIRS, by); break
        case 'q': moves = [...slideMoves(s, [r, f], BISHOP_DIRS, by), ...slideMoves(s, [r, f], ROOK_DIRS, by)]; break
        case 'k': moves = stepMoves(s, [r, f], KING_DELTAS, by); break
        default:  moves = []
      }
      if (moves.some(([tr, tf]) => tr === sq[0] && tf === sq[1])) return true
    }
  }
  return false
}

export function isCheck(s: State, me: Color): boolean {
  const k = findKing(s, me)
  return k ? isAttacked(s, k, opposite(me)) : false
}

// ======================================================
// -------- 5. APPLY MOVE -------------------------------
// ======================================================
//
// Pure: takes a state, returns a new state. Handles
// en-passant capture, promotion (defaults to queen),
// castling rook-shuffle, and updates castling rights /
// en-passant target / halfmove clock / fullmove counter.

export function applyMove(
  s: State, from: Square, to: Square, promotion: string = 'q',
): State {
  const piece = s.board[from[0]][from[1]]
  const me = colorOf(piece)!
  const captured = s.board[to[0]][to[1]]
  const board = s.board.map((row) => row.slice())
  const t = piece.toLowerCase()

  if (t === 'p') {
    // en-passant: captured pawn sits on `from`'s rank, `to`'s file
    if (s.enPassant && to[0] === s.enPassant[0] && to[1] === s.enPassant[1]) {
      board[from[0]][to[1]] = ''
    }
    const lastRank = me === 'w' ? 0 : 7
    board[from[0]][from[1]] = ''
    board[to[0]][to[1]] = to[0] === lastRank
      ? (me === 'w' ? promotion.toUpperCase() : promotion.toLowerCase())
      : piece
  } else if (t === 'k' && Math.abs(to[1] - from[1]) === 2) {
    // castling: move king + matching rook
    board[from[0]][from[1]] = ''
    board[to[0]][to[1]] = piece
    const rank = from[0]
    if (to[1] === 6) { board[rank][5] = board[rank][7]; board[rank][7] = '' }
    else            { board[rank][3] = board[rank][0]; board[rank][0] = '' }
  } else {
    board[from[0]][from[1]] = ''
    board[to[0]][to[1]] = piece
  }

  // castling rights: any king move clears both, any rook move clears its side
  let castling = s.castling
  if (piece === 'K') castling = castling.replace(/[KQ]/g, '')
  if (piece === 'k') castling = castling.replace(/[kq]/g, '')
  if (piece === 'R' && from[0] === 7 && from[1] === 0) castling = castling.replace('Q', '')
  if (piece === 'R' && from[0] === 7 && from[1] === 7) castling = castling.replace('K', '')
  if (piece === 'r' && from[0] === 0 && from[1] === 0) castling = castling.replace('q', '')
  if (piece === 'r' && from[0] === 0 && from[1] === 7) castling = castling.replace('k', '')
  // also: capturing a rook on its home square clears the matching right
  if (to[0] === 7 && to[1] === 0) castling = castling.replace('Q', '')
  if (to[0] === 7 && to[1] === 7) castling = castling.replace('K', '')
  if (to[0] === 0 && to[1] === 0) castling = castling.replace('q', '')
  if (to[0] === 0 && to[1] === 7) castling = castling.replace('k', '')
  if (!castling) castling = '-'

  const enPassant: Square | null =
    t === 'p' && Math.abs(to[0] - from[0]) === 2
      ? [(from[0] + to[0]) / 2, from[1]]
      : null

  return {
    board,
    turn: opposite(me),
    castling,
    enPassant,
    halfmove: t === 'p' || captured ? 0 : s.halfmove + 1,
    fullmove: me === 'b' ? s.fullmove + 1 : s.fullmove,
  }
}

// ======================================================
// -------- 6. LEGAL MOVES — ★ EXTENSION HOOK ★ ---------
// ======================================================
//
// >>> THIS IS WHERE YOU CUSTOMIZE CHESS RULES <<<
//
// Standard chess: a pseudo-legal move is legal iff it
// doesn't leave the moving side's king in check.
//
// To build "sentient chess" rules, replace or wrap this
// function. Everything above is rule-agnostic mechanics
// (geometry, attack detection, state transitions) you
// can reuse as primitives. Examples:
//
//   - Per-piece personality: switch on `s.board[from[0]][from[1]]`
//     and consult an LLM / agent before returning destinations
//   - Add new move types: extend `pseudoLegalMoves` with new
//     piece glyphs, then keep this filter as-is
//   - Relax king-safety: drop the `isCheck` filter to allow
//     "kamikaze" moves
//
// Keep this function pure — async/LLM logic belongs in a
// React-side wrapper, not in this engine.

export function legalMoves(s: State, from: Square): Square[] {
  const piece = s.board[from[0]][from[1]]
  if (!piece || colorOf(piece) !== s.turn) return []
  return pseudoLegalMoves(s, from).filter((to) => {
    const next = applyMove(s, from, to)
    return !isCheck(next, s.turn)
  })
}

// ======================================================
// -------- 7. GAME-END DETECTION -----------------------
// ======================================================

export function allLegalMoves(s: State): { from: Square; to: Square }[] {
  const out: { from: Square; to: Square }[] = []
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = s.board[r][f]
      if (!piece || colorOf(piece) !== s.turn) continue
      for (const to of legalMoves(s, [r, f])) out.push({ from: [r, f], to })
    }
  }
  return out
}

export const isCheckmate = (s: State) => isCheck(s, s.turn) && allLegalMoves(s).length === 0
export const isStalemate = (s: State) => !isCheck(s, s.turn) && allLegalMoves(s).length === 0
