'use client';

// Where a workspace frame is, told to its workbench (docs/specs/013-workspace/workbench-embeds.md "Workbench
// messages", blueprint "Workspace messages", WB63): `livehuddle:place` after every move and whenever a field of the
// place changes, never twice with the same fields. The Explorer reports its views, the editor its document; this is
// the one sender. Logged by view only, never a name.
import { useCallback, useRef } from 'react';
import type { PlaceMessage } from '@livehuddle/api-schema';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import type { WorkbenchPort } from '@/lib/workbench/workbench-port';

export type PlaceFields = Omit<PlaceMessage, 'type' | 'v'>;

export function useWorkspacePlaceMessages(port: WorkbenchPort): (fields: PlaceFields) => void {
  const lastSent = useRef<string | null>(null);
  return useCallback(
    (fields: PlaceFields) => {
      const message: PlaceMessage = { type: 'livehuddle:place', v: 1, ...fields };
      const key = JSON.stringify(message);
      if (key === lastSent.current) return;
      lastSent.current = key;
      port.send(message);
      debugLog('[workbench] place', { view: fields.view });
    },
    [port],
  );
}

// An Explorer view's place: the folder shown and its own documents, null elsewhere.
export function explorerPlaceFields(input: {
  view: string;
  folderId: string | null;
  folderName: string | null;
  documentCount: number | null;
  role: PlaceFields['role'];
}): PlaceFields {
  return {
    ...input,
    documentId: null,
    documentName: null,
    tabId: null,
    tabName: null,
  };
}
