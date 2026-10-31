'use client';

// A card's Age (docs/specs/026-plan/item-types.md "Card display"): how long it has sat in its status, "4d", quiet
// under a week, amber from CARD_AGE_WARN_DAYS, red from CARD_AGE_ALERT_DAYS. Today comes from useToday, one timeout
// shared by every reader and re-armed at local midnight, so the count rolls over with no reload and no timer per card.
import {
  cardAgeDays,
  cardAgeLabel,
  cardAgeText,
  cardAgeTone,
  itemStatusSince,
  type Item,
} from '@liveplanner/items';
import { useToday } from '@/hooks/ui/useToday';
import { LATE_COLOUR, MetaPill, SOON_COLOUR } from './plan-card-parts';
import type { PlanPalette } from './plan-palette';
import { PlanTypeGlyph } from './plan-type-glyph';

const TONES = {
  quiet: { colour: undefined, weight: undefined },
  warn: { colour: SOON_COLOUR, weight: 'font-semibold' },
  alert: { colour: LATE_COLOUR, weight: 'font-bold' },
} as const;

export function AgePill({
  item,
  statusName,
  palette,
}: {
  item: Item;
  // Its column's name, as its board shows it, for the spoken label.
  statusName: string;
  palette: PlanPalette;
}) {
  const today = useToday();
  const days = cardAgeDays(itemStatusSince(item), today);
  const tone = TONES[cardAgeTone(days)];
  return (
    <MetaPill
      palette={palette}
      {...(tone.colour ? { tone: tone.colour } : {})}
      label={cardAgeLabel(days, statusName)}
    >
      <PlanTypeGlyph glyph="hourglass" size={11} />
      <span aria-hidden className={tone.weight}>
        {cardAgeText(days)}
      </span>
    </MetaPill>
  );
}
