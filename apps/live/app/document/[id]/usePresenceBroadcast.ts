import { useEffect, type MutableRefObject } from 'react';

import type { connectRoom } from '@/lib/api-client';
import type { SelectionStore } from '@/lib/selection-store';

interface PresenceBroadcastDeps {
  hydrated: boolean;
  documentId: string | null;
  documentShareable: boolean;
  documentTeamId: string | null;
  // Read and followed here, not passed as a value: the editor root never renders for a selection
  // (docs/specs/008-canvas/blueprints/selection-store.md "Above the canvas").
  selection: SelectionStore;
  activeId: string;
  roomRef: MutableRefObject<ReturnType<typeof connectRoom> | null>;
}

// Outbound realtime presence: broadcast our local selection + active-tab
// focus so peers can render "Tom is working on this element" indicators and
// our avatar on the TabBar entry we're focused on. Both effects share the
// same gate (room open + hydrated + the document is actually shared, whether
// by link or by team). Extracted from useEditorState as a cohesive slice.
export function usePresenceBroadcast({
  hydrated,
  documentId,
  documentShareable,
  documentTeamId,
  selection,
  activeId,
  roomRef,
}: PresenceBroadcastDeps) {
  // Sends whenever the selected element changes (including to null). Skipped before
  // the room is open or before hydration; peers learn the initial selection
  // state via their own `select` ops when they happen, not from a snapshot.
  // Carries the active tab so peers scope the badge (and the docs/specs/007-editor/live-app.md
  // selection lock) to the right tab — element ids alone aren't unique
  // across tabs in older documents.
  useEffect(() => {
    if (!hydrated || !documentId || (!documentShareable && !documentTeamId)) return;
    let sent = selection.get().selectedId;
    const send = (elementId: string | null) =>
      roomRef.current?.send({ kind: 'op', op: { kind: 'select', elementId, tabId: activeId } });
    send(sent);
    return selection.subscribe(() => {
      const { selectedId } = selection.get();
      if (selectedId === sent) return;
      sent = selectedId;
      send(selectedId);
    });
  }, [hydrated, documentId, documentShareable, documentTeamId, selection, activeId, roomRef]);

  // Fires both on initial room connect (when the dependencies first satisfy)
  // and on every local tab switch.
  useEffect(() => {
    if (!hydrated || !documentId || (!documentShareable && !documentTeamId)) return;
    roomRef.current?.send({ kind: 'op', op: { kind: 'tab-focus', tabId: activeId } });
  }, [hydrated, documentId, documentShareable, documentTeamId, activeId, roomRef]);
}
