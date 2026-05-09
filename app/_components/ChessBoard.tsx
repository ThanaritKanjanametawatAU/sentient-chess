'use client'

import { useState } from 'react'
import {
  parseFen, legalMoves, applyMove, colorOf,
  isCheck, isCheckmate, isStalemate, START_FEN,
  type State, type Square,
} from '../_lib/chess'

// ======================================================
// PIECE → SVG  (★ Option A: explicit lookup ★)
// ------------------------------------------------------
// FEN char convention:
//   uppercase = white  (K Q R B N P)
//   lowercase = black  (k q r b n p)
// SVG files live in /public/pieces/ and are served at
// /pieces/<wK|wQ|...|bP>.svg (12 files total).
//
// >>> YOUR TURN — fill in the remaining 11 entries <<<
// One example given so the convention is unambiguous.
// ======================================================
const PIECE_SRC: Record<string, string> = {
  K: '/pieces/wK.svg',
  Q: '/pieces/wQ.svg', 
  R: '/pieces/wR.svg', 
  B: '/pieces/wB.svg', 
  N: '/pieces/wN.svg', 
  P: '/pieces/wP.svg',  
  k: '/pieces/bK.svg', 
  q: '/pieces/bQ.svg', 
  r: '/pieces/bR.svg', 
  b: '/pieces/bB.svg', 
  n: '/pieces/bN.svg', 
  p: '/pieces/bP.svg'

  // TODO: Q, R, B, N, P,  k, q, r, b, n, p
}

export default function ChessBoard() {
  const [state, setState] = useState<State>(() => parseFen(START_FEN))
  const [selected, setSelected] = useState<Square | null>(null)

  const targets = selected ? legalMoves(state, selected) : []
  const isTarget = (r: number, f: number) =>
    targets.some(([tr, tf]) => tr === r && tf === f)

  function handleClick(r: number, f: number) {
    if (selected && isTarget(r, f)) {
      setState(applyMove(state, selected, [r, f]))
      setSelected(null)
      return
    }
    const piece = state.board[r][f]
    setSelected(piece && colorOf(piece) === state.turn ? [r, f] : null)
  }

  const status =
    isCheckmate(state) ? `Checkmate — ${state.turn === 'w' ? 'Black' : 'White'} wins`
    : isStalemate(state) ? 'Stalemate'
    : `${state.turn === 'w' ? 'White' : 'Black'} to move${isCheck(state, state.turn) ? ' (check)' : ''}`

  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-lg font-semibold dark:text-white">{status}</h2>
      <div className="grid grid-cols-8 grid-rows-8 w-[480px] h-[480px] border border-black dark:border-white">
        {state.board.map((row, rank) =>
          row.map((piece, file) => {
            const isDark = (rank + file) % 2 === 1
            const isSelected = selected?.[0] === rank && selected?.[1] === file
            const showDot = isTarget(rank, file)
            return (
              <button
                key={`${rank}-${file}`}
                onClick={() => handleClick(rank, file)}
                className={[
                  'relative flex items-center justify-center focus:outline-none',
                  isDark ? 'bg-amber-700' : 'bg-amber-100',
                  isSelected ? 'ring-2 ring-blue-500 ring-inset' : '',
                ].join(' ').trim()}
              >
                {piece && PIECE_SRC[piece] && (
                  // plain <img> bypasses next/image's SVG security flag
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={PIECE_SRC[piece]} alt={piece} className="w-[85%] h-[85%]" />
                )}
                {showDot && (
                  <span className="absolute w-3 h-3 rounded-full bg-emerald-500/60 pointer-events-none" />
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
