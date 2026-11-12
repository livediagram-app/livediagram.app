// The type editor's Display pieces (ItemTypeDisplay): a field's name and icon as its chip shows them, the bar
// marking where a dragged field lands, and the menu that places an available field on a part of the card.
import type { ReactNode } from 'react';
import {
  isCustomCardField,
  typeFieldLabel,
  type CardField,
  type CardSlot,
  type ItemTypeDef,
} from '@liveplanner/items';
import { PlusIcon, lucideGlyph } from '@liveplanner/ui';
import { lucideImage } from '@liveworkspace/icons/lucide';
import { FIELD_GLYPHS } from './card-field-glyphs';
import { CARD_FIELD_LABELS } from './board-setup-edits';
import { PlanTypeGlyph } from './plan-type-glyph';
import { customFieldIcon } from './CustomFieldKindParts';

const PicturesGlyph = lucideGlyph(lucideImage, 14);

// A field's name and icon: a built-in's own, or a custom field's (its label, its kind's icon).
const customOf = (type: ItemTypeDef, f: CardField) =>
  isCustomCardField(f) ? (type.custom ?? []).find((c) => c.id === f) : undefined;
export const fieldLabel = (type: ItemTypeDef, f: CardField) =>
  customOf(type, f)?.label ||
  (isCustomCardField(f) ? 'Custom Field' : typeFieldLabel(type, f, CARD_FIELD_LABELS[f]));
export const fieldIcon = (type: ItemTypeDef, f: CardField, size = 14) => {
  const custom = customOf(type, f);
  if (custom)
    return (
      <span className="flex" style={{ width: size, height: size }}>
        <span className="flex [&_svg]:h-full [&_svg]:w-full">{customFieldIcon(custom)}</span>
      </span>
    );
  // Attachments draws its picture glyph, as on the card.
  if (f === 'attachments')
    return (
      <span className="flex [&_svg]:h-full [&_svg]:w-full" style={{ width: size, height: size }}>
        <PicturesGlyph />
      </span>
    );
  return f === 'key' ? (
    <span className="text-[12px] font-semibold leading-none">#</span>
  ) : (
    <PlanTypeGlyph glyph={FIELD_GLYPHS[f as keyof typeof FIELD_GLYPHS] ?? 'note'} size={size} />
  );
};

// Where a dragged field lands: a bar between chips.
export const DROP_MARKER = (
  <span
    key="drop-marker"
    data-drop-marker=""
    aria-hidden
    className="h-5 w-[3px] shrink-0 self-center rounded-full bg-brand-500 shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-brand-500)_20%,transparent)] dark:bg-brand-400"
  />
);

// Where an available field goes: a row per part of the card.
export function PlaceMenu({
  title,
  slots,
  labelOf,
  onPick,
}: {
  title: string;
  slots: readonly CardSlot[];
  labelOf: (slot: CardSlot) => string;
  onPick: (slot: CardSlot) => void;
}): ReactNode {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-900">
      <span className="px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </span>
      {slots.map((s) => (
        <button
          key={s}
          type="button"
          className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          onClick={() => onPick(s)}
        >
          <PlusIcon size={12} />
          {labelOf(s)}
        </button>
      ))}
    </div>
  );
}
