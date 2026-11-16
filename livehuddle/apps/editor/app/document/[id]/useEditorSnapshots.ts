'use client';

// Snapshots in this editor (docs/specs/013-workspace/snapshots.md "In the editor"): offered to an Editor of the whole
// Space stored on the server, never in This Browser, an embed, the workbench frame or a tab-scoped link. The api
// answers everyone else 404 all the same, so this is presentation; the dialog itself is the shared one.

import { useCallback } from 'react';
import { useItemSnapshotsDoor, type SnapshotsDoor } from '@liveworkspace/snapshots/ui';
import { API_BASE, apiFetch, apiHeaders } from '@/lib/api/core';

export function useEditorSnapshots(input: {
  hydrated: boolean;
  isOffline: boolean;
  embedMode: boolean;
  workbench: unknown;
  isStructureReadOnly: boolean;
  level: string;
  documentId: string | null;
  selfId: string | null;
  shareCode: string | null;
}): SnapshotsDoor | null {
  const ownerId = input.selfId && input.selfId !== 'self' ? input.selfId : null;
  const allowed =
    input.hydrated &&
    !input.isOffline &&
    !input.embedMode &&
    !input.workbench &&
    !input.isStructureReadOnly &&
    input.level === 'edit' &&
    ownerId !== null;
  const shareCode = input.shareCode;
  const headers = useCallback(
    (opts: { body?: boolean }) => apiHeaders(ownerId ?? '', { share: shareCode, body: opts.body }),
    [ownerId, shareCode],
  );
  return useItemSnapshotsDoor({
    allowed,
    itemUrl: input.documentId
      ? `${API_BASE}/documents/${encodeURIComponent(input.documentId)}`
      : null,
    noun: 'Space',
    viewerId: ownerId,
    apiFetch,
    apiHeaders: headers,
  });
}
