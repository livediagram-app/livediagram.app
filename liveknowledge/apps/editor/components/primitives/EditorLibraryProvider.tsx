'use client';

// The Library in liveknowledge's editor (liveworkspace/docs/specs/006-media/libraries.md): the workbench's provider on this
// app's door. A document kept only in this browser (no owner) has none.

import { useMemo } from 'react';
import { LibraryProvider } from '@liveworkspace/workbench/components/library/LibraryProvider';
import { libraryApiOver } from '@liveworkspace/workbench/lib/library/library-api';
import { API_BASE, apiFetch, apiHeaders } from '@/lib/api/core';
import { apiFetchImageBlobUrl, releaseImageBlobUrl } from '@/lib/api/images';
import { track } from '@/lib/telemetry';
import { useToast } from '@/hooks/ui/useToast';
import { useOptionalEditorContext } from '@/app/document/[id]/EditorContext';

// Saving to the Library and placing from it, counted by whose library (libraries.md "Telemetry").
const librarySaved = (scope: 'personal' | 'team') =>
  track('Library', 'Created', scope === 'team' ? 'Team' : 'Personal');
const libraryPlaced = (scope: 'personal' | 'team') =>
  track('Library', 'Added', scope === 'team' ? 'Team' : 'Personal');

export function EditorLibraryProvider({
  ownerId,
  children,
}: {
  ownerId: string | null;
  children: React.ReactNode;
}) {
  const api = useMemo(
    () =>
      ownerId
        ? libraryApiOver({
            base: `${API_BASE}/library`,
            fetch: apiFetch,
            headers: (opts) => apiHeaders(ownerId, opts),
          })
        : null,
    [ownerId],
  );
  // A place that fails says so on the canvas too, so it is seen with the palette closed (libraries.md "Placing").
  const toast = useToast();
  // Where the canvas shows a picture from, so a save sends its small copies for the tile (libraries.md "Pictures").
  const editor = useOptionalEditorContext();
  const documentId = editor?.documentId ?? undefined;
  const shareCode = editor?.sessionShareCode ?? null;
  const pictures = useMemo(
    () =>
      ownerId
        ? {
            url: (imageId: string) =>
              apiFetchImageBlobUrl(ownerId, imageId, { documentId, shareCode }),
            release: releaseImageBlobUrl,
          }
        : undefined,
    [ownerId, documentId, shareCode],
  );
  return (
    <LibraryProvider
      api={api}
      pictures={pictures}
      onSaved={librarySaved}
      onPlaced={libraryPlaced}
      onPlaceFailed={toast.error}
    >
      {children}
    </LibraryProvider>
  );
}
