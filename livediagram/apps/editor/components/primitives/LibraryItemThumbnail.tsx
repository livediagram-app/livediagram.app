'use client';

import { useEffect, useState } from 'react';
import type { ShapeLibraryItem } from '@livediagram/api-schema';
import { libraryItemThumbnail } from '@/lib/shape-library-thumbnail';

// A shape library item drawn small (docs/specs/013-workspace/shape-libraries.md): the palette's My
// shapes tiles and the Explorer's Shape libraries cards. Drawn after the surface has painted, in a box
// whose size never changes, so nothing shifts; a drawing that fails leaves the box empty, logged once.

const failed = new Set<string>();

function useThumbnail(item: ShapeLibraryItem): string | null {
  const [url, setUrl] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (failed.has(item.id)) return;
    let alive = true;
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

export function LibraryItemThumbnail({
  item,
  className,
}: {
  item: ShapeLibraryItem;
  // The box: its size and frame. The picture fits inside it.
  className: string;
}) {
  const url = useThumbnail(item);
  return (
    <span className={`flex items-center justify-center overflow-hidden ${className}`}>
      {url ? (
        // A data URL, so a plain <img> (inert: the SVG never runs); decorative, as what holds it
        // carries the name.
        <img src={url} alt="" className="max-h-full max-w-full object-contain p-0.5" />
      ) : null}
    </span>
  );
}
