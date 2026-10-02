'use client';

import { useEffect, useState } from 'react';
import type { ShapeLibraryItem } from '@livediagram/api-schema';
import { LIBRARY_SHAPE_DND_MIME } from '@/lib/shape-library-dnd';
import { libraryItemThumbnail } from '@/lib/shape-library-thumbnail';

// One shape of a library in the palette's My shapes (docs/specs/013-workspace/shape-libraries.md "Using
// a library"): its thumbnail over its title. A click (or Enter / Space) places it at the middle of
// the view; a drag carries it to the drop point. The box is the same before and after the thumbnail
// draws, so nothing shifts.

const failed = new Set<string>();

function useThumbnail(item: ShapeLibraryItem): string | null {
  const [url, setUrl] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (failed.has(item.id)) return;
    let alive = true;
    // After the panel has painted: thumbnails never hold up opening the category.
    const handle = window.setTimeout(() => {
      libraryItemThumbnail(item).then(
        (next) => {
          if (alive) setUrl({ id: item.id, url: next });
        },
        (error: unknown) => {
          failed.add(item.id);
          console.warn('[shape-libraries] thumbnail failed', {
            cause: error instanceof Error ? `${error.name}: ${error.message}` : 'unknown',
          });
        },
      );
    }, 0);
    return () => {
      alive = false;
      window.clearTimeout(handle);
    };
  }, [item]);
  return url?.id === item.id ? url.url : null;
}

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
  const thumbnail = useThumbnail(item);
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
      <span className="flex h-12 w-full items-center justify-center overflow-hidden rounded bg-white ring-1 ring-slate-200 dark:ring-slate-700">
        {thumbnail ? (
          // A data URL, so a plain <img> (inert: the SVG never runs); decorative, as the button
          // carries the name.
          <img src={thumbnail} alt="" className="max-h-full max-w-full object-contain p-0.5" />
        ) : null}
      </span>
      <span className="w-full truncate text-center text-[10px] leading-none">{title}</span>
    </button>
  );
}
