'use client'

import { useState, type DragEvent } from 'react'
import {
  parseFen, legalMoves, applyMove, colorOf,
  isCheck, isCheckmate, isStalemate, START_FEN,
  type State, type Square,
} from '../_lib/chess'

// ======================================================
// PIECE → SVG  (Option A: explicit lookup)
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
  p: '/pieces/bP.svg',
}

// chess.com-style colors (inline-styled to bypass Tailwind hot-reload jitter)
const HIGHLIGHT_YELLOW = 'rgba(255, 220, 0, 0.45)'   // selected + last-move
const TARGET_GREEN     = 'rgba(20,  80, 50, 0.50)'   // legal-move dot / capture ring

export default function ChessBoard() {
  const [state, setState] = useState<State>(() => parseFen(START_FEN))
  const [selected, setSelected] = useState<Square | null>(null)
  const [dragging, setDragging] = useState<Square | null>(null)
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null)

  const targets = selected ? legalMoves(state, selected) : []
  const isTarget = (r: number, f: number) =>
    targets.some(([tr, tf]) => tr === r && tf === f)

  function commit(from: Square, to: Square) {
    const moves = legalMoves(state, from)
    if (!moves.some(([tr, tf]) => tr === to[0] && tf === to[1])) return
    setState(applyMove(state, from, to))
    setLastMove({ from, to })
    setSelected(null)
  }

  // -- click-to-move ---------------------------------
  function onClick(r: number, f: number) {
    if (selected && isTarget(r, f)) {
      commit(selected, [r, f])
      return
    }
    const piece = state.board[r][f]
    setSelected(piece && colorOf(piece) === state.turn ? [r, f] : null)
  }

  // -- drag-and-drop ---------------------------------
  function onDragStart(e: DragEvent, r: number, f: number) {
    const piece = state.board[r][f]
    if (!piece || colorOf(piece) !== state.turn) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData('text/plain', `${r},${f}`)
    e.dataTransfer.effectAllowed = 'move'
    setSelected([r, f])
    setDragging([r, f])
  }
  // preventDefault is the "drop is allowed" signal — only on legal targets
  function onDragOver(e: DragEvent, r: number, f: number) {
    if (isTarget(r, f)) e.preventDefault()
  }
  function onDrop(e: DragEvent, r: number, f: number) {
    e.preventDefault()
    const data = e.dataTransfer.getData('text/plain')
    if (!data) return
    const [sr, sf] = data.split(',').map(Number)
    commit([sr, sf], [r, f])
    setDragging(null)
  }
  function onDragEnd() {
    // fires on both successful drop and cancel — idempotent cleanup
    setDragging(null)
    setSelected(null)
  }

  const status =
    isCheckmate(state) ? `Checkmate — ${state.turn === 'w' ? 'Black' : 'White'} wins`
    : isStalemate(state) ? 'Stalemate'
    : `${state.turn === 'w' ? 'White' : 'Black'} to move${isCheck(state, state.turn) ? ' (check)' : ''}`

  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-lg font-semibold dark:text-white">{status}</h2>
      <div
        className="grid grid-cols-8 grid-rows-8 w-[480px] h-[480px] border border-black dark:border-white"
        style={{ userSelect: 'none' }}
      >
        {state.board.map((row, rank) =>
          row.map((piece, file) => {
            const isDark        = (rank + file) % 2 === 1
            const isSelected    = selected?.[0] === rank && selected?.[1] === file
            const isLastFrom    = lastMove && lastMove.from[0] === rank && lastMove.from[1] === file
            const isLastTo      = lastMove && lastMove.to[0]   === rank && lastMove.to[1]   === file
            const highlighted   = isSelected || isLastFrom || isLastTo
            const targetSquare  = isTarget(rank, file)
            const captureTarget = targetSquare && !!piece
            const beingDragged  = dragging?.[0] === rank && dragging?.[1] === file
            const canDrag       = !!piece && colorOf(piece) === state.turn

            return (
              <button
                key={`${rank}-${file}`}
                onClick={() => onClick(rank, file)}
                onDragStart={(e) => onDragStart(e, rank, file)}
                onDragOver={(e) => onDragOver(e, rank, file)}
                onDrop={(e) => onDrop(e, rank, file)}
                onDragEnd={onDragEnd}
                style={{ position: 'relative' }}
                className={[
                  'flex items-center justify-center focus:outline-none',
                  isDark ? 'bg-amber-700' : 'bg-amber-100',
                ].join(' ')}
              >
                {/* highlight overlay (selected / last-move) */}
                {highlighted && (
                  <span style={{
                    position: 'absolute', inset: 0,
                    background: HIGHLIGHT_YELLOW,
                    pointerEvents: 'none',
                  }} />
                )}

                {/* the piece */}
                {piece && PIECE_SRC[piece] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={PIECE_SRC[piece]}
                    alt={piece}
                    draggable={canDrag}
                    style={{
                      position: 'relative',  // stack above yellow overlay
                      width: '85%', height: '85%',
                      opacity: beingDragged ? 0.35 : 1,
                      cursor: canDrag ? 'grab' : 'default',
                    }}
                  />
                )}

                {/* legal-move indicator: dot for empty, ring for capture */}
                {targetSquare && (captureTarget ? (
                  <span style={{
                    position: 'absolute', inset: '4%',
                    borderRadius: '50%',
                    boxSizing: 'border-box',
                    border: `4px solid ${TARGET_GREEN}`,
                    pointerEvents: 'none',
                  }} />
                ) : (
                  <span style={{
                    position: 'absolute',
                    width: '28%', height: '28%',
                    borderRadius: '50%',
                    background: TARGET_GREEN,
                    pointerEvents: 'none',
                  }} />
                ))}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
