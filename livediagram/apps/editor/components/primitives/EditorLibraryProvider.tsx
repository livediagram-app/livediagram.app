'use client';

// The Library in livediagram's editor (liveworkspace/docs/specs/006-media/libraries.md): the workbench's provider on
// this app's door, with the person's own shape libraries (docs/specs/013-workspace/shape-libraries.md) joined to
// Personal, one folder per library, read where they are. Inside ShapeLibraryProvider, whose list it reads.

import { useMemo } from 'react';
import { elementKinds, legacyItemId } from '@liveworkspace/media';
import {
  LibraryProvider,
  type LocalLibraryItem,
} from '@liveworkspace/workbench/components/library/LibraryProvider';
import { useShapeLibraries } from '@/components/primitives/ShapeLibraryProvider';
import { libraryApiFor } from '@/lib/api/library';

// This app, as the media service names it: its shape libraries' ids in the Library carry it.
const MEDIA_APP_NAME = 'livediagram.app' as const;

export function EditorLibraryProvider({
  ownerId,
  children,
}: {
  ownerId: string | null;
  children: React.ReactNode;
}) {
  const api = useMemo(() => (ownerId ? libraryApiFor(ownerId) : null), [ownerId]);
  const { libraries } = useShapeLibraries();
  const localItems = useMemo<LocalLibraryItem[]>(
    () =>
      libraries.flatMap((library) =>
        library.items.map((item, i) => ({
          elements: item.elements,
          summary: {
            id: legacyItemId({ app: MEDIA_APP_NAME, libraryId: library.id, itemId: item.id }),
            scope: 'personal' as const,
            teamId: null,
            folder: library.name,
            title: item.title.trim() || `Shape ${i + 1}`,
            width: item.width,
            height: item.height,
            kinds: elementKinds(item.elements),
            preview: null,
            app: MEDIA_APP_NAME,
            createdAt: library.createdAt,
            updatedAt: library.updatedAt,
            legacy: { app: MEDIA_APP_NAME, libraryId: library.id },
          },
        })),
      ),
    [libraries],
  );
  return (
    <LibraryProvider api={api} localItems={localItems}>
      {children}
    </LibraryProvider>
  );
}
