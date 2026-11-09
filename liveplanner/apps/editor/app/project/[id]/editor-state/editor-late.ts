import type { RefObject } from 'react';
import type { usePlanSlice } from '@/hooks/plan/usePlanSlice';

// What a slice reads from a slice composed after it. Each is read when a callback runs (a commit, a
// changeset's Show, a deep link landing), never while rendering, so the composer hands each one over as a
// getter of the later slice's value in the same render.
export type EditorLate = {
  // The commit choke point's active-layer stamp (useEditorEditing), read by commitTabs (useEditorProject).
  activeLayerStampRef: () => RefObject<{ tabId: string; layerId: string } | null>;
  // A changeset's Show (useEditorViewport), read by the changeset feed (useEditorPersistence).
  revealChangesetRef: () => RefObject<(tabId: string, ids: readonly string[]) => void>;
  // The Plan slice (useEditorPlan), read when an Inbox link opens a card (useEditorEditing).
  plan: () => ReturnType<typeof usePlanSlice>;
};
