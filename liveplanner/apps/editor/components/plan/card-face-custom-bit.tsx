// A custom field's bit on a card face (docs/specs/026-plan/item-types.md "Card display"), as PlanCardFace.tsx draws
// it where the type's Display places it: its kind's glyph (a linked card's own, in its colour) and value, a Percent's
// bar, a Card field's linked numbers, a Formula's problem. A plain function the face calls, never a component of
// its own, so the card's tree stays one face.
import type { ReactNode } from 'react';
import {
  ITEM_TYPES,
  FORMULA_ERROR_TEXT,
  calculatedText,
  fieldCardIds,
  holdsSeveral,
  isCustomCardField,
  isNewerField,
  itemColourOf,
  linkedCard,
  pastDue,
  percentShown,
  showsAsPercent,
  typeIn,
  type CardField,
  type CustomFieldDef,
  type FormulaOutcome,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import type { PlanCardData } from './PlanCardContext';
import { customFieldText } from './custom-field-text';
import { CUSTOM_KIND_ICONS } from './CustomFieldKindParts';
import { customKindPill, isBuiltInKindPill } from './CustomKindPill';
import { PercentChip } from './PercentBar';
import { LinkedNumbersPill } from './SeveralValuesPills';
import { accentOn, type PlanPalette } from './plan-palette';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ColourDot } from './ColourSwatches';
import { CommentsPill, LATE_COLOUR, MetaPill } from './plan-card-parts';

export type CustomBitContext = {
  item: Item;
  type: ItemTypeDef;
  palette: PlanPalette;
  plan: PlanCardData | undefined;
  muted: boolean | undefined;
  // The card's Calculated fields shown, and their worked-out values in the same order.
  calcDefs: readonly CustomFieldDef[];
  outcomes: readonly FormulaOutcome[];
  // The cards its Card fields link to, by id.
  items: ReadonlyMap<string, Item>;
};

export function customFieldBit(
  f: CardField,
  { item, type, palette, plan, muted, calcDefs, outcomes, items }: CustomBitContext,
): ReactNode {
  const def = isCustomCardField(f) ? (type.custom ?? []).find((c) => c.id === f) : undefined;
  // A field a newer liveplanner made is never drawn here (item-types.md "Fields from a newer version").
  if (def && isNewerField(def)) return null;
  // A Comments field counts its own open threads, as the built-in's chip (item-types.md "Comments and Votes fields").
  if (def?.kind === 'comments')
    return (
      <CommentsPill key={f} item={item} palette={palette} type={type} field={f} name={def.label} />
    );
  // A field of a built-in kind draws as its built-in field does, an Image as its thumbnail.
  if (def && isBuiltInKindPill(def)) return customKindPill(def, item.fields[def.id], palette);
  // A Calculated field's value is worked out (docs/specs/026-plan/item-types.md "Calculated fields"); a Formula
  // that can't be on this card reads "Error", its problem spoken with it and shown in the panel ("Formula
  // fields").
  const outcome = def?.kind === 'calculated' ? (outcomes[calcDefs.indexOf(def)] ?? null) : null;
  // A Percent field, or a share shown as one, draws its bar (docs/specs/026-plan/item-types.md "Percent").
  if (def && showsAsPercent(def) && outcome?.ok !== false) {
    const share = percentShown(
      def,
      def.kind === 'calculated'
        ? outcome?.ok && typeof outcome.value === 'number'
          ? outcome.value
          : null
        : item.fields[def.id],
    );
    return share === undefined ? null : (
      <PercentChip key={f} name={def.label} value={share} palette={palette} />
    );
  }
  // A Card field that holds several reads its linked cards' numbers (item-types.md "Holds Several").
  if (def?.kind === 'card' && holdsSeveral(def))
    return plan ? (
      <LinkedNumbersPill
        key={f}
        label={def.label}
        ids={fieldCardIds(def, item.fields[def.id])}
        items={items}
        types={plan.types}
        palette={palette}
      />
    ) : null;
  if (def && outcome && !outcome.ok)
    return (
      <MetaPill
        key={f}
        palette={palette}
        tone={LATE_COLOUR}
        label={`${def.label}: ${FORMULA_ERROR_TEXT}. ${outcome.error}`}
      >
        <span className="flex [&_svg]:h-[11px] [&_svg]:w-[11px]">
          {CUSTOM_KIND_ICONS[def.kind]}
        </span>
        <span aria-hidden>{FORMULA_ERROR_TEXT}</span>
      </MetaPill>
    );
  const text = !def
    ? null
    : def.kind === 'calculated'
      ? outcome?.ok
        ? calculatedText(def, outcome.value)
        : null
      : customFieldText(def, item.fields[def.id], items);
  if (!def || !text) return null;
  // A linked card with its own Colour shows it (a Parent project's colour), else its own type's glyph (a field
  // may link to several types), the field's first type's while the card is missing.
  const linked =
    def.kind === 'card' && plan
      ? linkedCard(items, fieldCardIds(def, item.fields[def.id])[0])
      : undefined;
  const linkedTypeId = def.kind === 'card' ? (linked?.type ?? def.linkType) : undefined;
  const linkedType = linkedTypeId ? typeIn(plan?.types ?? ITEM_TYPES, linkedTypeId) : undefined;
  const linkedColour = linked ? itemColourOf(linked, linkedType) : undefined;
  // A Date and Time or Date Range that has passed draws red, as an overdue Due does, never on a done card
  // (item-types.md "Past due").
  const late = !muted && pastDue(def, item.fields[def.id]);
  return (
    <MetaPill
      key={f}
      palette={palette}
      {...(late ? { tone: LATE_COLOUR } : {})}
      label={`${def.label}: ${text}${late ? ', overdue' : ''}`}
    >
      {linkedColour ? (
        <ColourDot colour={linkedColour} />
      ) : linkedType ? (
        <PlanTypeGlyph
          glyph={linkedType.glyph}
          size={11}
          color={accentOn(linkedType.color, palette)}
        />
      ) : (
        <span className="flex [&_svg]:h-[11px] [&_svg]:w-[11px]">
          {CUSTOM_KIND_ICONS[def.kind]}
        </span>
      )}
      <span aria-hidden className="max-w-[10rem] truncate">
        {text}
      </span>
    </MetaPill>
  );
}
