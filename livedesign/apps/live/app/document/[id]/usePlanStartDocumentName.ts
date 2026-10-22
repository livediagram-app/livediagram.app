'use client';

// Start Planning names the document as every other start does (docs/specs/007-editor/templates-by-mode.md "The
// document's name"): a board, sheet, form, dashboard or visualisation picked for the document's first tab names a
// document still on a default name after the title that tab takes ("Untitled Bug Tracker"). Those starts name the tab
// inside the tab's own change (plan-tabs.md "Names"), so this reads the result: the first tab, loaded and not yet a
// Plan tab, becoming one in this session. A start that named the document itself (a template, through
// useTemplateFlow) is left alone, and a name someone gave the document is kept.
import { useEffect, useRef } from 'react';
import { isDefaultTabName, isPlanTabKind, type Tab } from '@livedesign/document';

/** The document's name after a Plan start that gave its first tab `tabName`. */
export function untitledNameForPlanStart(tabName: string): string {
  return `Untitled ${tabName.trim()}`;
}

type Seen = { id: string; planned: boolean; loaded: boolean; name: string };

export function usePlanStartDocumentName({
  firstTab,
  firstTabLoaded,
  documentName,
  nameDocument,
  canEdit,
}: {
  firstTab: Pick<Tab, 'id' | 'kind' | 'name'> | undefined;
  firstTabLoaded: boolean;
  documentName: string;
  nameDocument: (name: string) => void;
  canEdit: boolean;
}): void {
  const seen = useRef<Seen | null>(null);
  const id = firstTab?.id;
  const kind = firstTab?.kind;
  const tabName = firstTab?.name ?? '';
  useEffect(() => {
    if (id === undefined) return;
    const planned = isPlanTabKind(kind);
    const prev = seen.current;
    seen.current = { id, planned, loaded: firstTabLoaded, name: documentName };
    // Only a change seen here: the same tab, loaded before, becoming a Plan tab now. Opening a document whose first
    // tab already is one, or its content arriving, is not a start.
    if (!canEdit || !prev || prev.id !== id || !prev.loaded || prev.planned || !planned) return;
    // The start named the document already (a template's own untitled name), or the tab kept a default name.
    if (prev.name !== documentName || isDefaultTabName(tabName)) return;
    void import('@/lib/template-builders').then(({ isDefaultDocumentName }) => {
      if (!isDefaultDocumentName(documentName)) return;
      const named = untitledNameForPlanStart(tabName);
      if (named !== documentName) nameDocument(named);
    });
    // nameDocument is the editor's own setter, remade each render; the change it reacts to is the tab's.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [id, kind, tabName, firstTabLoaded, documentName, canEdit]);
}
