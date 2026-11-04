'use client';

// A card type drawn as a small card in its colour with its glyph: the one picture of a type wherever one is picked or
// listed (the board header's chips, the Add a Card menu, the Card Types panel; docs/specs/026-plan/plan-board.md
// "Card type chips"), so a type looks the same in each.
import { PlanCardTileArt } from './plan-tile-art';
import { ACCENT_TEXT, accentVars } from './plan-palette';

export function CardTypeTile({
  color,
  glyph,
  size = 22,
}: {
  color: string;
  glyph: string | undefined;
  size?: number;
}) {
  return (
    <span className={`flex shrink-0 ${ACCENT_TEXT}`} style={accentVars(color)} aria-hidden>
      <PlanCardTileArt size={size} color={color} glyph={glyph} />
    </span>
  );
}
