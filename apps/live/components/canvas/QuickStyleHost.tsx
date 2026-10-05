'use client';

// The Quick Style panel's host (docs/specs/008-canvas/blueprints/selection-store.md "Above the canvas"):
// it reads the selection from the store and builds the panel's view from it, so a selection change
// renders this and the panel, never the editor root that hands it everything else.

import type { ComponentProps } from 'react';
import { QuickStylePanel } from '@/components/canvas/QuickStylePanel';
import { useSelectionOf } from '@/hooks/canvas/useSelectionStore';
import { useQuickStyle, type QuickStyleDeps } from '@/hooks/canvas/useQuickStyle';
import { sameMembers, selectionIds, type Selection } from '@/lib/selection-store';

const selectionSetOf = (s: Selection) => selectionIds(s.selectedId, s.multiSelectedIds);

export function QuickStyleHost({
  deps,
  ...panel
}: { deps: QuickStyleDeps } & Omit<ComponentProps<typeof QuickStylePanel>, 'quickStyle'>) {
  const ids = useSelectionOf(selectionSetOf, sameMembers);
  const quickStyle = useQuickStyle({ ...deps, selectionIds: ids });
  return <QuickStylePanel {...panel} quickStyle={quickStyle} />;
}
