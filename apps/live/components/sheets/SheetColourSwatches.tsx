'use client';

// The toolbar's Text Colour and Fill Colour (docs/specs/029-sheets/sheet.md "Toolbar"): a quick row of the one colour
// picker (docs/specs/004-interface-design/colour-picker.md "Quick Style", "The rule for new work"): the Theme
// Palette's first five colours drawn with the one swatch, the cell's own picked, and a + that opens the full picker.
// One Tab stop, the arrows move through the row (the picker's keyboard).
import { lucidePlus } from '@livediagram/icons/lucide';
import { Tooltip, lucideGlyph } from '@livediagram/ui';
import { ColourSwatch } from '@/components/colour/ColourSwatch';
import { optionMatches, themeOptions } from '@/components/colour/colour-options';
import { onColourKeys } from '@/components/colour/useColourKeys';
import { useThemeColours } from '@/components/colour/useThemeColours';
import { getTheme, themePresetColors } from '@/lib/themes';

const PlusGlyph = lucideGlyph(lucidePlus, 14);

export const TOOLBAR_SWATCHES = 5;
// Five 24 px swatches, the +, and the 2 px gaps between.
export const SWATCHES_PX = (TOOLBAR_SWATCHES + 1) * 24 + TOOLBAR_SWATCHES * 2;

// Outside an editor (a test, a read-only render) the default theme's colours.
const DEFAULT_THEME = themeOptions(themePresetColors(getTheme(undefined)));

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function SheetColourSwatches({
  name,
  value,
  onPick,
  onMore,
}: {
  // What they colour ("Text Colour"): the group's accessible name, and the + button's.
  name: string;
  // The cell's own colour, picked when it is one of them.
  value: string | undefined;
  onPick: (colour: string) => void;
  onMore: (anchor: HTMLElement) => void;
}) {
  const theme = useThemeColours();
  const options = (theme.length > 0 ? theme : DEFAULT_THEME).slice(0, TOOLBAR_SWATCHES);
  const pickedAt = options.findIndex((o) => optionMatches(o, value));
  const tabStop = pickedAt >= 0 ? pickedAt : 0;
  return (
    <span
      role="group"
      aria-label={name}
      className="flex items-center gap-0.5"
      onPointerDown={stop}
      onKeyDown={onColourKeys}
    >
      {options.map((option, i) => (
        <ColourSwatch
          key={option.id}
          label={option.label}
          colour={option.colour}
          picked={i === pickedAt}
          tabIndex={i === tabStop ? 0 : -1}
          onClick={() => onPick(option.colour)}
        />
      ))}
      <Tooltip label={`More ${name}s`}>
        <button
          type="button"
          aria-label={`More ${name}s`}
          aria-haspopup="menu"
          data-colour-key=""
          tabIndex={-1}
          className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-400 text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={(e) => onMore(e.currentTarget)}
        >
          <PlusGlyph />
        </button>
      </Tooltip>
    </span>
  );
}
