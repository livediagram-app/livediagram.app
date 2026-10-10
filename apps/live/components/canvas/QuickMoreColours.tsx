'use client';

// A Quick Style colour row's last target (docs/specs/004-interface-design/colour-picker.md
// "Skins"): More colours, a swatch button opening the full colour picker, with the row's own
// colours as its Theme Palette (Diagram mode), the standard colours and Custom colours.
import { standardColours } from '@livediagram/document';
import { useDocumentColours } from '@/hooks/ui/useDocumentColours';
import { ColourSwatchButton } from '@/components/colour/ColourSwatchButton';
import type { ColourGroup, ColourOption } from '@/components/colour/colour-options';

export function QuickMoreColours({
  rowTitle,
  value,
  theme,
  standard,
  onPick,
}: {
  rowTitle: string;
  // The colour in force (a stock name or a hex), or null.
  value: string | null;
  theme?: readonly ColourOption[];
  standard: ColourGroup;
  onPick: (id: string) => void;
}) {
  const yours = useDocumentColours(theme?.map((o) => o.colour));
  return (
    <ColourSwatchButton
      label={`More colours, ${rowTitle.toLowerCase()}`}
      swatch=""
      value={value}
      theme={theme}
      standard={[standard]}
      yours={yours}
      onPick={onPick}
      triggerProps={{ tabIndex: -1, 'data-colour-key': '', 'data-quick-more': '' }}
      className="h-6 w-6 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      <MoreColoursGlyph />
    </ColourSwatchButton>
  );
}

// Four of the standard colours (Red, Orange, Green, Blue), in their order.
const GLYPH_DOTS = [2, 3, 5, 7].map((i) => standardColours('strong', 'light')[i]!.hex);

// Four dots in the colour order, inside the swatch's 20px square: "more colours".
function MoreColoursGlyph() {
  return (
    <span
      aria-hidden
      className="grid h-5 w-5 grid-cols-2 place-items-center rounded-[5px] border border-dashed border-slate-400 p-[3px] dark:border-slate-500"
    >
      {GLYPH_DOTS.map((c) => (
        <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />
      ))}
    </span>
  );
}
