// The Plan category's tile glyphs (docs/specs/025-plan/plan-mode.md "The palette"): a board drawn as
// its columns, and a card drawn with its item type's colour stripe, at the palette's tile size.
import { Glyph } from '@livediagram/ui';

export function PlanBoardTileArt({ size, columns }: { size: number; columns: number }) {
  const inner = 18;
  const gap = 1.2;
  const w = (inner - gap * (columns - 1)) / columns;
  return (
    <Glyph size={size} units={22}>
      <rect x="1.5" y="3" width="19" height="16" rx="2" />
      {Array.from({ length: columns }, (_, i) => {
        const x = 2 + i * (w + gap);
        return (
          <g key={i}>
            <rect x={x + 0.4} y="6" width={Math.max(0.8, w - 0.8)} height="2.6" rx="0.6" />
            {i % 2 === 0 ? (
              <rect x={x + 0.4} y="10" width={Math.max(0.8, w - 0.8)} height="2.6" rx="0.6" />
            ) : null}
          </g>
        );
      })}
    </Glyph>
  );
}

export function PlanCardTileArt({ size, color }: { size: number; color: string }) {
  return (
    <Glyph size={size} units={22}>
      <rect x="3" y="5" width="16" height="12" rx="2" />
      <rect x="3" y="5" width="3" height="12" rx="1.2" fill={color} stroke="none" />
      <path d="M9 9H16M9 13H14" />
    </Glyph>
  );
}
