import { useEffect, useState } from 'react';

// A number that moves on whenever webfonts land, for a re-render (and a re-measure) each time.
// docs/specs/004-interface-design/fonts.md loads them with `display=swap` from a stylesheet that
// does not hold up first paint, so faces arrive AFTER first paint, and the stylesheet itself may
// arrive after the canvas has mounted.
//
// This exists because auto-fit measures the face it paints:
// a webfont can be much wider than the fallback the browser
// swaps in while the file is in flight. Measure during that window and the note keeps a size
// fitted to the wrong face (text over the edge of the paper) with nothing to trigger a re-measure
// on a canvas nobody has touched yet. `loadingdone` fires for every batch of faces that finishes,
// including one that starts later (a face first picked, or a stylesheet that came in late);
// `document.fonts.ready` covers loads that settled before the listener was attached.
//
// Calling it purely for the re-render is the normal use; the value doubles as a cache key.
export function useFontEpoch(): number {
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    if (!fonts) return;
    let alive = true;
    const bump = () => {
      if (alive) setEpoch((n) => n + 1);
    };
    if (fonts.status !== 'loaded') void fonts.ready?.then(bump);
    fonts.addEventListener?.('loadingdone', bump);
    return () => {
      alive = false;
      fonts.removeEventListener?.('loadingdone', bump);
    };
  }, [fonts]);

  return epoch;
}
