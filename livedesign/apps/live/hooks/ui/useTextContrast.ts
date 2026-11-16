'use client';

import { useContext, useMemo } from 'react';
import type { Element } from '@livedesign/design';
import { useCanvasSurface } from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
import { EditorContext } from '@/app/design/[id]/EditorContext';
import { textContrastProbe, type TextContrastProbe } from '@/lib/text-contrast-probe';

// The element menu Text row's contrast probe (docs/specs/004-interface-design/colour-picker.md
// "Reading on its ground"), worked out only while its picker is open, so a closed menu never walks
// the tab. Undefined outside the editor or where nothing can be judged.
export function useTextContrast(el: Element, open: boolean): TextContrastProbe | undefined {
  const tab = useContext(EditorContext)?.activeTab;
  const surface = useCanvasSurface();
  return useMemo(
    () => (open && tab ? (textContrastProbe(el, tab, surface) ?? undefined) : undefined),
    [open, tab, el, surface],
  );
}
