// A card type's chip (docs/specs/026-plan/plan-board.md "Card type chips"): the small card in the type's colour with
// its glyph, then its name. A board's header draws it at `md` as a button; the Overview draws the same face a size up
// in its Card Types tiles (`lg`) and a size down in Recent Activity (`sm`). The box classes and the face are shared so
// the three never drift apart; the caller adds whatever makes it a control (cursor, hover, focus).
import type { ItemTypeDef } from '@liveplanner/items';
import { PlanCardTileArt } from './plan-tile-art';
import { ACCENT_TEXT, accentVars } from './plan-palette';

export type CardTypeChipSize = 'sm' | 'md' | 'lg';

type ChipType = Pick<ItemTypeDef, 'label' | 'color' | 'glyph'>;

const ART: Record<CardTypeChipSize, number> = { sm: 16, md: 22, lg: 28 };

const BOX: Record<CardTypeChipSize, { box: string; named: string; bare: string }> = {
  sm: {
    box: 'flex h-6 shrink-0 items-center gap-1 rounded-md text-[12px] font-medium',
    named: 'pl-1 pr-2',
    bare: 'px-1',
  },
  md: {
    box: 'flex h-8 shrink-0 items-center gap-1.5 rounded-lg text-[13px] font-medium',
    named: 'pl-1.5 pr-2.5',
    bare: 'px-1.5',
  },
  lg: {
    box: 'flex h-10 shrink-0 items-center gap-2 rounded-xl text-[15px] font-medium',
    named: 'pl-2 pr-3',
    bare: 'px-2',
  },
};

// The chip's box: its height, rounding, type and padding (less on the right when it shows no name).
export function cardTypeChipClass(size: CardTypeChipSize = 'md', named = true): string {
  const b = BOX[size];
  return `${b.box} ${named ? b.named : b.bare}`;
}

// What sits inside the box: the type's card picture, then its name unless `named` is false.
export function CardTypeChipFace({
  type,
  size = 'md',
  named = true,
}: {
  type: ChipType;
  size?: CardTypeChipSize;
  named?: boolean;
}) {
  return (
    <>
      <span className={`shrink-0 ${ACCENT_TEXT}`} style={accentVars(type.color)}>
        <PlanCardTileArt size={ART[size]} color={type.color} glyph={type.glyph} />
      </span>
      {named ? <span className="min-w-0 truncate whitespace-nowrap">{type.label}</span> : null}
    </>
  );
}

// The chip drawn to be looked at, not pressed: the face in its box.
export function CardTypeChip({
  type,
  size = 'md',
  className = '',
}: {
  type: ChipType;
  size?: CardTypeChipSize;
  className?: string;
}) {
  return (
    <span data-card-type-chip-face="" className={`${cardTypeChipClass(size)} ${className}`}>
      <CardTypeChipFace type={type} size={size} />
    </span>
  );
}
