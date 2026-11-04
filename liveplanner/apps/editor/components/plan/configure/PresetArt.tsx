// A Configure preset's drawing (docs/specs/026-plan/plan-board.md "Configure"): the board's layout in miniature,
// three columns of cards drawn in currentColor, so a glance tells the presets apart. Decorative.
import type { PresetArtKind } from './board-presets';

const COLS = [6, 30, 54];
const COL_W = 20;

function Card({ x, y, h = 6, strong }: { x: number; y: number; h?: number; strong?: boolean }) {
  return (
    <rect
      x={x + 2}
      y={y}
      width={COL_W - 4}
      height={h}
      rx={1.5}
      fill="currentColor"
      opacity={strong ? 0.9 : 0.45}
    />
  );
}

export function PresetArt({ id, className }: { id: PresetArtKind; className?: string }) {
  return (
    <svg viewBox="0 0 80 56" className={className} aria-hidden="true">
      {COLS.map((x) => (
        <rect
          key={x}
          x={x}
          y={4}
          width={COL_W}
          height={48}
          rx={2.5}
          fill="currentColor"
          opacity={0.12}
        />
      ))}
      {id === 'people' || id === 'types' || id === 'lanes' ? (
        <>
          {/* Rows across the columns, each with its marker at the left. */}
          {[4, 21, 38].map((y, row) => (
            <g key={y}>
              {row > 0 ? (
                <line
                  x1={4}
                  x2={76}
                  y1={y - 1.5}
                  y2={y - 1.5}
                  stroke="currentColor"
                  strokeOpacity={0.35}
                  strokeWidth={0.75}
                />
              ) : null}
              {id === 'people' ? (
                <circle cx={9} cy={y + 4} r={2.6} fill="currentColor" opacity={0.85} />
              ) : id === 'lanes' ? (
                <rect
                  x={5}
                  y={y + 2.5}
                  width={8}
                  height={3}
                  rx={1.5}
                  fill="currentColor"
                  opacity={0.85}
                />
              ) : (
                <rect
                  x={6.5}
                  y={y + 1.5}
                  width={5}
                  height={5}
                  rx={1}
                  fill="currentColor"
                  opacity={0.85}
                />
              )}
              <Card x={COLS[1]!} y={y + 2} />
              {row !== 1 ? (
                <Card x={COLS[2]!} y={y + 2} />
              ) : (
                <Card x={COLS[0]! + 8} y={y + 2} h={5} />
              )}
            </g>
          ))}
        </>
      ) : id === 'sorted' ? (
        // Sorted: the strongest card on top of each column, fading down.
        COLS.map((x, c) =>
          [0, 1, 2, 3]
            .slice(0, 4 - (c % 2))
            .map((i) => (
              <rect
                key={`${x}-${i}`}
                x={x + 2}
                y={8 + i * 10}
                width={COL_W - 4}
                height={7}
                rx={1.5}
                fill="currentColor"
                opacity={0.9 - i * 0.22}
              />
            )),
        )
      ) : id === 'overview' ? (
        // Many small cards.
        COLS.map((x, c) =>
          [0, 1, 2, 3, 4, 5, 6]
            .slice(0, 7 - c)
            .map((i) => <Card key={`${x}-${i}`} x={x} y={8 + i * 6} h={4} />),
        )
      ) : (
        // Simple columns: a few full cards each, as they were put.
        COLS.map((x, c) =>
          [0, 1, 2]
            .slice(0, 3 - (c === 1 ? 1 : 0))
            .map((i) => (
              <Card key={`${x}-${i}`} x={x} y={8 + i * 13} h={10} strong={i === 0 && c === 0} />
            )),
        )
      )}
    </svg>
  );
}
