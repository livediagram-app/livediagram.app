'use client';

// Plan's colours on the one colour picker (docs/specs/004-interface-design/colour-picker.md; docs/specs/026-plan/items.md
// "Colour"): a card type's Colour in the type editor, a swatch at the end of its Name field opening the picker in a
// popover, and an item's own Colour in the item panel, a field that opens the picker with None first. Both offer the strong standard colours for light paper, Custom colours
// and +, and store the hex. ColourDot draws an item's colour beside its type colour (a Parent chip, a Project swimlane
// header, a Gantt row).
import { ColourField } from '@/components/colour/ColourField';
import { ColourSwatchButton } from '@/components/colour/ColourSwatchButton';
import { colourName, noColour, standardGroup } from '@/components/colour/colour-options';
import { useDocumentColours } from '@/hooks/ui/useDocumentColours';

// Colours Plan offered before the standard colours, so a card still holding one is named by its word.
const EARLIER_PLAN_COLOURS: Readonly<Record<string, string>> = {
  '#18181b': 'Black',
  '#71717a': 'Grey',
  '#64748b': 'Slate',
  '#2563eb': 'Blue',
  '#eab308': 'Yellow',
  '#dc2626': 'Red',
  '#16a34a': 'Green',
  '#7c3aed': 'Violet',
  '#d97706': 'Amber',
  '#0d9488': 'Teal',
  '#db2777': 'Pink',
  '#ea580c': 'Orange',
  '#0891b2': 'Cyan',
};

/** A Plan colour's word: a standard colour's, an earlier Plan swatch's, else "#rrggbb". */
export function planColourName(hex: string): string {
  return EARLIER_PLAN_COLOURS[hex.toLowerCase()] ?? colourName(hex);
}

// The id the picker hands back for None.
const NONE = 'none';
const STANDARD = [standardGroup('strong', 'light', 'hex')];
const NONE_OPTION = [noColour(NONE, 'None')];

/**
 * A card type's Colour: a swatch of it at the end of the type editor's Name field, opening the picker in a popover.
 * Always a colour, never None. Escape closes the popover only, so the type editor stays open.
 */
export function TypeColourButton({
  value,
  onChange,
  label = 'Colour',
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
}) {
  const yours = useDocumentColours();
  return (
    <ColourSwatchButton
      label={label}
      swatch={value}
      value={value}
      standard={STANDARD}
      yours={yours}
      onPick={(id) => onChange(id.toLowerCase())}
      className="h-7 w-7 hover:bg-slate-100 dark:hover:bg-slate-800"
    />
  );
}

/**
 * An item's own Colour in the card panel: a field naming the colour (or None), opening the picker with None first.
 * Escape closes the picker only, handing focus back to the field, so the card panel stays open.
 */
export function ColourSelect({
  value,
  onChange,
  label = 'Colour',
  disabled = false,
  id,
}: {
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}) {
  const yours = useDocumentColours();
  return (
    <ColourField
      id={id}
      label={label}
      disabled={disabled}
      value={value ?? NONE}
      none={!value}
      swatch={value ?? 'transparent'}
      name={value ? planColourName(value) : 'None'}
      leading={NONE_OPTION}
      standard={STANDARD}
      yours={yours}
      onPick={(picked) => onChange(picked === NONE ? undefined : picked.toLowerCase())}
    />
  );
}

// An item's own colour as a small ringed dot, named for a screen reader by its colour word.
export function ColourDot({ colour, className = '' }: { colour: string; className?: string }) {
  return (
    <span
      role="img"
      aria-label={`${planColourName(colour)} colour`}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20 ${className}`}
      style={{ backgroundColor: colour }}
    />
  );
}
