'use client';

// A Quick Style colour row's last target (docs/specs/004-interface-design/colour-picker.md
// "Skins"): More colours, a swatch button opening the full colour picker, with the row's own
// colours as its Theme Palette, the standard colours and Custom colours. On the Text
// colour row it also says whether the colour reads where the selected text sits ("Reading on its ground").
import { useContext, useMemo, useState } from 'react';
import type { Element } from '@liveknowledge/document';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import { useDocumentColours } from '@/hooks/ui/useDocumentColours';
import { useTextContrast } from '@/hooks/ui/useTextContrast';
import { ColourSwatchButton } from '@/components/colour/ColourSwatchButton';
import { MoreColoursGlyph } from '@/components/colour/MoreColoursGlyph';
import type {
  ColourGroup,
  ColourOption,
} from '@liveworkspace/workbench/components/colour/colour-options';

const NONE: readonly Element[] = [];

export function QuickMoreColours({
  rowTitle,
  value,
  theme,
  standard,
  judgeIds,
  onPick,
}: {
  rowTitle: string;
  // The colour in force (a stock name or a hex), or null.
  value: string | null;
  theme?: readonly ColourOption[];
  standard: ColourGroup;
  // The elements whose text this row colours, judged for readability (the Text colour row only).
  judgeIds?: readonly string[];
  onPick: (id: string) => void;
}) {
  const yours = useDocumentColours(theme?.map((o) => o.colour));
  const [open, setOpen] = useState(false);
  // The selection read off the tab only while the picker is open, so a closed bar never walks the tab.
  const tab = useContext(EditorContext)?.activeTab;
  const judged = useMemo(() => {
    if (!open || !judgeIds || !tab) return NONE;
    const ids = new Set(judgeIds);
    return tab.elements.filter((el) => ids.has(el.id));
  }, [open, judgeIds, tab]);
  const contrast = useTextContrast(judged, open && judged.length > 0);
  return (
    <ColourSwatchButton
      label={`More colours, ${rowTitle.toLowerCase()}`}
      swatch=""
      value={value}
      theme={theme}
      standard={[standard]}
      yours={yours}
      contrast={contrast}
      onOpenChange={setOpen}
      onPick={onPick}
      triggerProps={{ tabIndex: -1, 'data-colour-key': '', 'data-quick-more': '' }}
      className="h-6 w-6 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      <MoreColoursGlyph />
    </ColourSwatchButton>
  );
}
