'use client';

import { useContext, useMemo, useState } from 'react';
import type { Element } from '@livedesign/design';
import { useCanvasSurface } from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
import { EditorContext } from '@/app/design/[id]/EditorContext';
import { textContrastProbes, type TextContrastProbe } from '@/lib/text-contrast-probe';
import { textGroundMemo } from '@/lib/text-ground-memo';

// A text colour picker's grounds (docs/specs/004-interface-design/colour-picker.md "Reading on its
// ground"): one probe for each of `els` whose ground can be judged, worked out only while its picker is
// open, so a closed menu never walks the tab. Each ground is memoised on what makes it (textGroundMemo),
// so a hover's live preview, which changes only the text colour, reuses it. Undefined outside the editor
// or where nothing can be judged.
export function useTextContrast(
  els: readonly Element[],
  open: boolean,
): TextContrastProbe[] | undefined {
  const tab = useContext(EditorContext)?.activeTab;
  const surface = useCanvasSurface();
  const [memo] = useState(textGroundMemo);
  return useMemo(
    () => (open && tab ? textContrastProbes(els, tab, surface, memo) : undefined),
    [open, tab, els, surface, memo],
  );
}
