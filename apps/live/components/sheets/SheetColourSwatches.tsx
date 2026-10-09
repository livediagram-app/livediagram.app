'use client';

// The toolbar's Text Colour (docs/specs/029-sheets/sheet.md "Toolbar"): the theme's first five colours as swatches,
// the cell's own ringed, and a + that opens the full colour picker (your colours, a custom colour).
import { useContext } from 'react';
import { Tooltip, lucideGlyph } from '@livediagram/ui';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import { getTheme, themePresetColors } from '@/lib/themes';
import { lucidePlus } from '@livediagram/icons/lucide';

const PlusGlyph = lucideGlyph(lucidePlus, 14);

export const TOOLBAR_SWATCHES = 5;
// Five 22 px swatches, the +, and the gaps between.
export const SWATCHES_PX = TOOLBAR_SWATCHES * 24 + 28;

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

// The open tab's theme colours, or the default theme's outside an editor (a test, a read-only render).
function useThemeSwatches(): readonly string[] {
  const editor = useContext(EditorContext);
  return themePresetColors(getTheme(editor?.activeTab?.theme));
}

export function SheetColourSwatches({
  name,
  value,
  onPick,
  onMore,
}: {
  // What they colour ("Text Colour"): the group's and its buttons' accessible names, and their tooltips.
  name: string;
  // The cell's own colour, ringed when it is one of them.
  value: string | undefined;
  onPick: (colour: string) => void;
  onMore: (anchor: HTMLElement) => void;
}) {
  const colours = useThemeSwatches();
  return (
    <span role="group" aria-label={name} className="flex items-center gap-0.5" onPointerDown={stop}>
      {colours.slice(0, TOOLBAR_SWATCHES).map((colour) => {
        const on = !!value && value.toLowerCase() === colour.toLowerCase();
        return (
          <Tooltip key={colour} label={`${name} ${colour.toUpperCase()}`}>
            <button
              type="button"
              aria-label={`${name} ${colour.toUpperCase()}`}
              aria-pressed={on}
              className={`flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-full transition hover:scale-110 motion-reduce:transition-none ${
                on ? 'ring-2 ring-brand-500 ring-offset-1 ring-offset-transparent' : ''
              }`}
              onClick={() => onPick(colour)}
            >
              <span
                aria-hidden
                className="h-4 w-4 rounded-full border border-black/15 dark:border-white/20"
                style={{ backgroundColor: colour }}
              />
            </button>
          </Tooltip>
        );
      })}
      <Tooltip label={`More ${name}s`}>
        <button
          type="button"
          aria-label={`More ${name}s`}
          aria-haspopup="menu"
          className="flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-full border border-dashed border-slate-400 text-slate-500 transition hover:border-slate-600 hover:text-slate-800 dark:border-slate-500 dark:text-slate-400 dark:hover:text-slate-100"
          onClick={(e) => onMore(e.currentTarget)}
        >
          <PlusGlyph />
        </button>
      </Tooltip>
    </span>
  );
}
