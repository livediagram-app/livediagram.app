'use client';

import type { ShapeLibraryItem } from '@livediagram/api-schema';
import { LibraryItemThumbnail } from '@/components/primitives/LibraryItemThumbnail';
import { LIBRARY_SHAPE_DND_MIME } from '@/lib/shape-library-dnd';

// One shape of a library in the palette's My shapes (docs/specs/013-workspace/shape-libraries.md "Using
// a library"): its thumbnail over its title. A click (or Enter / Space) places it at the middle of
// the view; a drag carries it to the drop point.
export function LibraryShapeTile({
  item,
  title,
  libraryId,
  libraryName,
  onInsert,
}: {
  item: ShapeLibraryItem;
  // The title shown: the item's own, or "Shape n" when it has none.
  title: string;
  libraryId: string;
  libraryName: string;
  onInsert: (item: ShapeLibraryItem) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Insert ${title} from ${libraryName}`}
      onClick={() => onInsert(item)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          LIBRARY_SHAPE_DND_MIME,
          JSON.stringify({ libraryId, itemId: item.id }),
        );
        e.dataTransfer.effectAllowed = 'copy';
      }}
      className="flex w-full flex-col items-center gap-1 rounded-md p-1 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      <LibraryItemThumbnail
        item={item}
        className="h-12 w-full rounded bg-white ring-1 ring-slate-200 dark:ring-slate-700"
      />
      <span className="w-full truncate text-center text-[10px] leading-none">{title}</span>
    </button>
  );
}
