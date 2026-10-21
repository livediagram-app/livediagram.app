'use client';

// A Quick Style colour row's last target (docs/specs/004-interface-design/colour-picker.md
// "Skins"): More colours, a swatch button opening the full colour picker, with the row's own
// colours as its Theme Palette (Diagram mode), the standard colours and Custom colours.
import { useDocumentColours } from '@/hooks/ui/useDocumentColours';
import { ColourSwatchButton } from '@/components/colour/ColourSwatchButton';
import { MoreColoursGlyph } from '@/components/colour/MoreColoursGlyph';
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
