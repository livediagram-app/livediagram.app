'use client';

// A field that holds several on the card face (docs/specs/026-plan/item-types.md "Holds Several"): a Person field's
// people as discs stacked a third over each other, and a Card field's linked cards as their numbers, each the first
// SEVERAL_ON_CARD then "+N" for the rest. Each is one accessible name listing every value; nothing when empty.
import { GlyphDisc } from '@liveplanner/ui';
import {
  itemColourOf,
  linkedCard,
  typeIn,
  itemTitle,
  type Item,
  type ItemPerson,
  type ItemTypeDef,
} from '@liveplanner/items';
import { MetaPill } from './plan-card-parts';
import { PersonDisc } from './PersonDisc';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ColourDot } from './ColourSwatches';
import { accentOn, type PlanPalette } from './plan-palette';

// How many values a card face draws before "+N".
export const SEVERAL_ON_CARD = 3;

// "Sam, Ana and 2 more": the first SEVERAL_ON_CARD names, then how many more.
export function severalNames(names: readonly string[]): string {
  const shown = names.slice(0, SEVERAL_ON_CARD);
  const more = names.length - shown.length;
  if (more > 0) return `${shown.join(', ')} and ${more} more`;
  return shown.length < 2
    ? (shown[0] ?? '')
    : `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}`;
}

export function PeopleStack({
  label,
  people,
  palette,
}: {
  label: string;
  people: readonly ItemPerson[];
  palette: PlanPalette;
}) {
  if (people.length === 0) return null;
  const shown = people.slice(0, SEVERAL_ON_CARD);
  const more = people.length - shown.length;
  // Each disc after the first sits a third over the one before, ringed in the card's colour so the edges read.
  const ring = { boxShadow: `0 0 0 1.5px ${palette.card}`, borderRadius: 9999 };
  return (
    <span
      role="img"
      aria-label={`${label}: ${severalNames(people.map((p) => p.name))}`}
      className="inline-flex shrink-0 items-center"
    >
      {shown.map((p, i) => (
        <span key={p.id} className={`inline-flex ${i ? '-ml-1' : ''}`} style={ring}>
          <PersonDisc person={p} />
        </span>
      ))}
      {more > 0 ? (
        <span className="-ml-1 inline-flex" style={ring}>
          <GlyphDisc
            aria-hidden
            size={20}
            className="text-[9px] font-semibold tabular-nums"
            style={{ backgroundColor: palette.column, color: palette.muted }}
          >
            +{more}
          </GlyphDisc>
        </span>
      ) : null}
    </span>
  );
}

export function LinkedNumbersPill({
  label,
  ids,
  items,
  types,
  palette,
}: {
  label: string;
  ids: readonly string[];
  items: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
  palette: PlanPalette;
}) {
  if (ids.length === 0) return null;
  const cards = ids.map((id) => linkedCard(items, id));
  const first = cards.find((c): c is Item => !!c);
  const firstType = first ? typeIn(types, first.type) : undefined;
  const colour = first ? itemColourOf(first, firstType) : undefined;
  const numbers = cards.slice(0, SEVERAL_ON_CARD).map((c) => (c ? `#${c.key}` : '?'));
  const more = ids.length - numbers.length;
  const spoken = cards.map((c) => (c ? `#${c.key} ${itemTitle(c)}` : 'Missing card')).join(', ');
  return (
    <MetaPill palette={palette} label={`${label}: ${spoken}`}>
      {colour ? (
        <ColourDot colour={colour} />
      ) : firstType ? (
        <PlanTypeGlyph
          glyph={firstType.glyph}
          size={11}
          color={accentOn(firstType.color, palette)}
        />
      ) : null}
      <span aria-hidden className="whitespace-nowrap">
        {numbers.join(' ')}
        {more > 0 ? ` +${more}` : ''}
      </span>
    </MetaPill>
  );
}
