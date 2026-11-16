'use client';

// The palette's Library in livediagram (liveworkspace/docs/specs/006-media/libraries.md): the shared Library tab, with
// the person's own shape libraries (docs/specs/013-workspace/shape-libraries.md) in Personal, drawn and dragged as
// they always were. Without the Library (a document kept only in this browser) it is My shapes as before.

import type { ShapeLibraryItem } from '@livediagram/api-schema';
import { parseLegacyItemId } from '@liveworkspace/media';
import { LibraryPaletteTab } from '@liveworkspace/workbench/components/library/LibraryPaletteTab';
import { useLibrary } from '@liveworkspace/workbench/components/library/LibraryProvider';
import { LibraryItemThumbnail } from '@/components/primitives/LibraryItemThumbnail';
import { useShapeLibraries } from '@/components/primitives/ShapeLibraryProvider';
import { LIBRARY_SHAPE_DND_MIME } from '@/lib/shape-library-dnd';
import { PaletteMyShapesTab } from './PaletteMyShapesTab';

export function PaletteLibraryTab({ onInsert }: { onInsert: (item: ShapeLibraryItem) => void }) {
  const library = useLibrary();
  const { libraries } = useShapeLibraries();
  if (!library) return <PaletteMyShapesTab onInsert={onInsert} />;
  // One of this app's shape library items, by its id in the Library.
  const ownItem = (id: string) => {
    const ref = parseLegacyItemId(id);
    if (!ref || ref.app !== 'livediagram.app') return null;
    const item = libraries
      .find((l) => l.id === ref.libraryId)
      ?.items.find((i) => i.id === ref.itemId);
    return item ? { ref, item } : null;
  };
  return (
    <LibraryPaletteTab
      // The door hands back elements this app's own migration and checks passed.
      onInsert={(item) => onInsert(item as ShapeLibraryItem)}
      thumbnailFor={(summary) => {
        const own = summary.preview ? null : ownItem(summary.id);
        return own ? <LibraryItemThumbnail item={own.item} className="h-full w-full" /> : null;
      }}
      dragFor={(summary) => {
        const own = ownItem(summary.id);
        return own
          ? {
              mime: LIBRARY_SHAPE_DND_MIME,
              data: JSON.stringify({ libraryId: own.ref.libraryId, itemId: own.ref.itemId }),
            }
          : null;
      }}
    />
  );
}
