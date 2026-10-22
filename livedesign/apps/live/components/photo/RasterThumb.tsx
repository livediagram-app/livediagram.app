'use client';

// A small picture of pixels over the checkerboard (a layer's or a mask's thumbnail).
import { useEffect, useRef } from 'react';
import type { Raster } from '@livedesign/photo-engine';
import { PREVIEW_CHECKER } from '@/components/dialogs/ImageExportPanel';

export function RasterThumb({
  raster,
  size,
  ringed = false,
  label,
}: {
  raster: Raster | null;
  size: number;
  // The target of painting.
  ringed?: boolean;
  label?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !raster) return;
    c.width = raster.width;
    c.height = raster.height;
    c.getContext('2d')?.putImageData(
      new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height),
      0,
      0,
    );
  }, [raster]);
  return (
    <span
      aria-label={label}
      role={label ? 'img' : undefined}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-sm bg-slate-100 dark:bg-slate-800 ${
        ringed ? 'ring-2 ring-brand-500' : 'ring-1 ring-slate-200 dark:ring-slate-700'
      }`}
      style={{ width: size, height: size }}
    >
      {raster ? (
        <canvas
          ref={ref}
          style={{
            background: PREVIEW_CHECKER,
            width: raster.width >= raster.height ? size : (size * raster.width) / raster.height,
            height: raster.height >= raster.width ? size : (size * raster.height) / raster.width,
          }}
        />
      ) : null}
    </span>
  );
}
