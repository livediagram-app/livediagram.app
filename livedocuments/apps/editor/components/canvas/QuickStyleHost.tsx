'use client';

// The Quick Style bar's host (docs/specs/008-canvas/blueprints/selection-store.md "Above the canvas"):
// it reads the selection from the store and builds the bar's view from it, so a selection change
// renders this and the bar, never the editor root that hands it everything else. Its other inputs it reads from the
// editor's chrome store, so a typing commit (new writing, nothing it styles changed) renders neither
// (docs/specs/007-editor/blueprints/flashcards.md "Performance and limits").

import { memo, useMemo, type ComponentProps } from 'react';
import dynamic from 'next/dynamic';
import type { QuickStyleBar as QuickStyleBarComponent } from '@/components/canvas/QuickStyleBar';
import { loadQuickStyleBar } from '@/lib/editor-deferred-code';
import { quickStyleBarPage } from '@/lib/quick-style-bar';
import { useSelectionOf } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { useQuickStyle } from '@/hooks/canvas/useQuickStyle';
import { useEditorChromeLatest } from '@/app/document/[id]/EditorContext';
import { sameDepsButWriting } from '@/app/document/[id]/editor-chrome-equal';
import {
  sameMembers,
  selectionIds,
  type Selection,
} from '@liveworkspace/workbench/lib/selection-store';

// Shown once something is selected; its code is fetched once the editor is idle (lib/editor-deferred-code.ts).
const QuickStyleBar = dynamic(loadQuickStyleBar, { ssr: false });

const selectionSetOf = (s: Selection) => selectionIds(s.selectedId, s.multiSelectedIds);

export const QuickStyleHost = memo(function QuickStyleHost(
  panel: Omit<ComponentProps<typeof QuickStyleBarComponent>, 'quickStyle' | 'pageId'>,
) {
  const deps = useEditorChromeLatest((s) => s.quickStyleDeps, sameDepsButWriting);
  const ids = useSelectionOf(selectionSetOf, sameMembers);
  const quickStyle = useQuickStyle({ ...deps, selectionIds: ids });
  // The page it sits on: the one holding most of what it styles.
  const targetIds = quickStyle.view?.targetIds;
  const elements = deps.activeTab.elements;
  const { pages } = deps;
  const pageId = useMemo(
    () => (targetIds ? quickStyleBarPage(targetIds, elements, pages) : null),
    [targetIds, elements, pages],
  );
  return <QuickStyleBar {...panel} quickStyle={quickStyle} pageId={pageId} />;
});
