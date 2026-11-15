import { useEffect, type MutableRefObject } from 'react';
import { useLocalBesideTab } from '@liveworkspace/workbench/lib/split-presence';
import { MAX_SELECTION_IDS } from '@livediagram/api-schema';

import type { connectRoom } from '@/lib/api-client';
import type { SelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import {
  broadcastSelection,
  type WriteHoldSources,
} from '@liveworkspace/workbench/lib/selection-write-hold';

interface PresenceBroadcastDeps {
  hydrated: boolean;
  documentId: string | null;
  // Every server-stored document has a room (docs/specs/024-agents/agent-changesets.md "Rooms for
  // personal documents"); this is all a personal one ever hears from us.
  documentServerStored: boolean;
  // Read and followed here, not passed as values: the editor root never renders for a selection
  // (docs/specs/008-canvas/blueprints/selection-store.md "Above the canvas").
  selection: SelectionStore;
  activeId: string;
  roomRef: MutableRefObject<ReturnType<typeof connectRoom> | null>;
  // Where an element we let go of is read as still being written (selection-write-hold): absent, the lock ends
  // with the selection.
  writing?: WriteHoldSources;
}

// Outbound realtime presence: our selection and active-tab focus, so peers render "Tom is working on
// this element" indicators and our avatar on the TabBar entry we're focused on, and so the api can
// refuse an agent changeset on an element we hold (docs/specs/024-agents/agent-changesets.md "Held
// elements"). Both effects share one gate: the room is open and hydrated. Extracted from
// useEditorState as a cohesive slice.
export function usePresenceBroadcast({
  hydrated,
  documentId,
  documentServerStored,
  selection,
  activeId,
  roomRef,
  writing,
}: PresenceBroadcastDeps) {
  // Sends the selection once the room is open, then on every change of it (including to nothing).
  // Peers learn the initial selection state via their own `select` ops when they happen, not from a
  // snapshot. Carries the active tab so peers scope the badge (and the docs/specs/007-editor/editor-app.md
  // selection lock) to the right tab — element ids alone aren't unique across tabs in older
  // documents. The store notifies only on a real change.
  //
  // An element we let go of while our change to it has not landed stays in `elementIds` until it has
  // (docs/specs/007-editor/editor-app.md "Held until the holder's change lands"): a hold's release, or the
  // WRITE_HOLD_MAX_MS bound, sends the selection again without it. A tab switch starts afresh.
  useEffect(() => {
    if (!hydrated || !documentId || !documentServerStored) return;
    return broadcastSelection({
      selection,
      tabId: activeId,
      maxIds: MAX_SELECTION_IDS,
      writing,
      send: (elementId, elementIds) =>
        roomRef.current?.send({
          kind: 'op',
          op: {
            kind: 'select',
            elementId,
            tabId: activeId,
            ...(elementIds.length > 0 ? { elementIds } : {}),
          },
        }),
    });
  }, [hydrated, documentId, documentServerStored, selection, activeId, roomRef, writing]);

  // Fires both on initial room connect (when the dependencies first satisfy)
  // and on every local tab switch, carrying the tab in the other pane while
  // working side by side (docs/specs/007-editor/split-view.md "Presence").
  const besideTabId = useLocalBesideTab();
  useEffect(() => {
    if (!hydrated || !documentId || !documentServerStored) return;
    roomRef.current?.send({
      kind: 'op',
      op: { kind: 'tab-focus', tabId: activeId, ...(besideTabId ? { besideTabId } : {}) },
    });
  }, [hydrated, documentId, documentServerStored, activeId, besideTabId, roomRef]);
}
