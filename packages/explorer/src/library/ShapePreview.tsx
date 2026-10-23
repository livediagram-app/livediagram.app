// A library shape drawn small: the SVG its app's API draws for it (`<shapeLibrariesPath>/<id>/previews`), shown as an
// <img> of a data URL so nothing in it runs. Until it arrives, or when the app could not draw it, the shape shows as
// a plain tile in its proportions.

import { useEffect, useState } from 'react';
import type { LibraryShape } from './types';

/** A plain tile in the shape's proportions: what a shape shows with nothing drawn. */
export function PlainShapeTile({ shape }: { shape: LibraryShape }) {
  const ratio = shape.width && shape.height ? shape.width / shape.height : 1;
  return (
    <span
      aria-hidden
      className="block max-h-[70%] max-w-[70%] rounded-sm border border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
      style={{
        aspectRatio: String(ratio),
        height: ratio >= 1 ? undefined : '70%',
        width: ratio >= 1 ? '70%' : undefined,
      }}
    />
  );
}

export function ShapePreview({
  shape,
  load,
}: {
  shape: LibraryShape;
  /** The shape's SVG, or null when there is none. */
  load: (shape: LibraryShape) => Promise<string | null>;
}) {
  const [drawn, setDrawn] = useState<{ shape: LibraryShape; src: string } | null>(null);
  useEffect(() => {
    let live = true;
    load(shape)
      .then((svg) => {
        if (live && svg)
          setDrawn({ shape, src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [shape, load]);
  if (drawn?.shape !== shape) return <PlainShapeTile shape={shape} />;
  return (
    <img
      src={drawn.src}
      alt=""
      draggable={false}
      className="block max-h-[80%] max-w-[80%] object-contain"
    />
  );
}
