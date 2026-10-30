'use client';

// Card Colour on a type's Display tab (docs/specs/026-plan/item-types.md "Fields by role"): which Colour field tints
// its cards, on boards, linked cards and Gantt bars alike. The built-in Colour first, then the type's own Colour
// fields; shown only while the type has one of its own to pick.
import { colourFieldOf, type ItemTypeDef } from '@liveplanner/items';
import { OptionRows } from './OptionRows';
import { SheetRow } from './PlanModal';

const BUILT_IN = 'color';

// The Colour fields a type can tint its cards by: the built-in (No Colour when the type does not offer it, so a pick
// can always be undone), then its own.
export function cardColourOptions(type: ItemTypeDef): { id: string; label: string }[] {
  const own = (type.custom ?? []).filter((c) => c.kind === 'colour' && type.fields.includes(c.id));
  return [
    { id: BUILT_IN, label: type.fields.includes(BUILT_IN) ? 'Colour' : 'No Colour' },
    ...own.map((c) => ({ id: c.id, label: c.label || 'Untitled field' })),
  ];
}

const Swatch = () => (
  <span
    aria-hidden
    className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15"
    style={{
      background: 'conic-gradient(#ef4444, #f59e0b, #22c55e, #3b82f6, #a855f7, #ef4444)',
    }}
  />
);

export function ItemTypeCardColour({
  type,
  onChange,
}: {
  // The type as drafted: its fields and its `colourField`.
  type: ItemTypeDef;
  // A custom field's id, or undefined for the built-in Colour (the default, not stored).
  onChange: (field: string | undefined) => void;
}) {
  const options = cardColourOptions(type);
  if (!options.some((o) => o.id !== BUILT_IN)) return null;
  return (
    <SheetRow label="Card Colour">
      <p className="mb-2 text-[12px] text-slate-500 dark:text-slate-400">
        The Colour field that tints this type&apos;s cards and Gantt bars.
      </p>
      <OptionRows
        kind="single"
        label="Card Colour"
        selected={colourFieldOf(type)}
        rows={options.map((o) => ({
          id: o.id,
          label: o.label,
          // No Colour reads as an empty ring, not a colour.
          icon:
            o.id === BUILT_IN && !type.fields.includes(BUILT_IN) ? (
              <span
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 rounded-full border border-dashed border-slate-400 dark:border-slate-500"
              />
            ) : (
              <Swatch />
            ),
        }))}
        onPick={(id) => onChange(id === BUILT_IN ? undefined : id)}
      />
    </SheetRow>
  );
}
