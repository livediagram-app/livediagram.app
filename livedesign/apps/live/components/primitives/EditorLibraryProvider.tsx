'use client';

// The Library in livedesign's editor (liveworkspace/docs/specs/006-media/libraries.md): the workbench's provider on this
// app's door. A document kept only in this browser (no owner) has none.

import { useMemo } from 'react';
import { LibraryProvider } from '@liveworkspace/workbench/components/library/LibraryProvider';
import { libraryApiOver } from '@liveworkspace/workbench/lib/library/library-api';
import { API_BASE, apiFetch, apiHeaders } from '@/lib/api/core';

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
  return <LibraryProvider api={api}>{children}</LibraryProvider>;
}
