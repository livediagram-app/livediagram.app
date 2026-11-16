'use client';

// The Library in livedocuments's editor (liveworkspace/docs/specs/006-media/libraries.md): the workbench's provider on this
// app's door. A document kept only in this browser (no owner) has none.

import { useMemo } from 'react';
import { LibraryProvider } from '@liveworkspace/workbench/components/library/LibraryProvider';
import { libraryApiFor } from '@/lib/api/library';

export function EditorLibraryProvider({
  ownerId,
  children,
}: {
  ownerId: string | null;
  children: React.ReactNode;
}) {
  const api = useMemo(() => (ownerId ? libraryApiFor(ownerId) : null), [ownerId]);
  return <LibraryProvider api={api}>{children}</LibraryProvider>;
}
