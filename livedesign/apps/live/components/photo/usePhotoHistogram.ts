'use client';

// The photo's histogram (docs/specs/031-photo/photo-pages.md "The Photo panel"), worked out from the
// preview-sized composite a moment after the photo last changed: shared by the panel and the Levels and
// Threshold settings.
import { useEffect, useRef, useState } from 'react';
import { histogramOf, type Histogram } from '@livedesign/photo-engine';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { previewRaster } from '@/lib/photo-editor/preview';

// The histogram is worked out again this long after the photo last changed, ms; the first one at once, so the panel
// never opens on an empty box.
export const HISTOGRAM_DELAY_MS = 600;

/** The histogram, `without` a layer (an adjustment layer's own Auto reads what is under it), and taken
 *  `once` (an applied adjustment's dialog, whose preview is written into the layer it reads). */
export function usePhotoHistogram(
  photo: PhotoEditorView,
  // `skip`: not wanted now (the Adjust tab with nothing that reads it), so nothing is worked out.
  opts: { without?: string; once?: boolean; skip?: boolean } = {},
): Histogram | null {
  const [hist, setHist] = useState<Histogram | null>(null);
  const s = photo.session;
  const { without, once = false, skip = false } = opts;
  // Taken once: the first version seen, never again.
  const [first] = useState(photo.version);
  const v = once ? first : photo.version;
  // Whether one has been worked out yet: the first goes at once.
  const worked = useRef(false);
  useEffect(() => {
    if (!s || skip) return;
    let live = true;
    const t = setTimeout(
      () => {
        const shown = without
          ? { ...s.photo, layers: s.photo.layers.filter((l) => l.id !== without) }
          : s.photo;
        // From the preview-sized composite: the shape of the tones, cheaply.
        void previewRaster(shown, s.lookup(), () => !live).then((r) => {
          if (!live || !r) return;
          worked.current = true;
          setHist(histogramOf(r, 2));
        });
      },
      worked.current ? HISTOGRAM_DELAY_MS : 0,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [s, v, without, skip]);
  return hist;
}

/** A histogram channel as an SVG area over a 256 x 64 box, square-rooted so the quiet tones show. */
export function histogramPath(bins: ArrayLike<number> | undefined): string {
  if (!bins) return '';
  let max = 1;
  for (let i = 0; i < 256; i++) max = Math.max(max, bins[i]!);
  let d = 'M0 64';
  for (let i = 0; i < 256; i++) d += `L${i} ${64 - Math.sqrt(bins[i]! / max) * 62}`;
  return `${d}L255 64Z`;
}
