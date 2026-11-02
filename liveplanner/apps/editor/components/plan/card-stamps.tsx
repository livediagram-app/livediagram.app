'use client';

// A card's stamps on its face (docs/specs/026-plan/items.md "Created and Last Edited", item-types.md "Card display"):
// Created At and Last Edited At as quiet pills of the viewer's local day, the full moment in the spoken label;
// Created By and Last Edited By as the person's disc. Nothing for a card stored without one.
import {
  dayLabel,
  itemStampPerson,
  itemStampTime,
  stampDay,
  stampMomentLabel,
  type Item,
  type StampField,
} from '@liveplanner/items';
import { MetaPill } from './plan-card-parts';
import type { PlanPalette } from './plan-palette';
import { PersonDisc } from './PersonDisc';
import { PlanTypeGlyph } from './plan-type-glyph';

const WORDS = {
  createdAt: { glyph: 'clock', short: 'Created', long: 'Created' },
  updatedAt: { glyph: 'pencil', short: 'Edited', long: 'Last edited' },
  createdBy: { long: 'Created by' },
  updatedBy: { long: 'Last edited by' },
} as const;

export function StampBit({
  item,
  field,
  palette,
}: {
  item: Item;
  field: StampField;
  palette: PlanPalette;
}) {
  if (field === 'createdBy' || field === 'updatedBy') {
    const who = itemStampPerson(item, field);
    return who ? <PersonDisc person={who} label={`${WORDS[field].long} ${who.name}`} /> : null;
  }
  const at = itemStampTime(item, field);
  if (at === undefined) return null;
  const words = WORDS[field];
  const full = `${words.long} ${stampMomentLabel(at)}`;
  return (
    <MetaPill palette={palette} label={full}>
      <PlanTypeGlyph glyph={words.glyph} size={11} />
      <span>
        {words.short} {dayLabel(stampDay(at))}
      </span>
    </MetaPill>
  );
}
