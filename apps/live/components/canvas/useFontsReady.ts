import { useEffect, useState } from 'react';

// Re-render once the webfonts have landed (spec/28 loads them with
// `display=swap`, so they arrive AFTER first paint).
//
// This exists because auto-fit measures the face it paints (spec/139): a
// workshop note is written in marker, and marker is much wider than the
// fallback the browser swaps in while the file is in flight. Measure during
// that window and the note keeps a size fitted to the wrong face — text over
// the edge of the paper — with nothing to trigger a re-measure on a board
// nobody has touched yet. One flip is enough: `document.fonts.ready` resolves
// when every pending load has settled.
//
// Returns the flag as well, for a caller that wants to branch on it; calling
// it purely for the re-render is the normal use.
export function useFontsReady(): boolean {
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  // A browser without the font-loading API (and SSR) starts ready rather than
  // waiting for a promise that will never arrive.
  const [ready, setReady] = useState(() => !fonts?.ready || fonts.status === 'loaded');

  useEffect(() => {
    if (!fonts?.ready) return;
    let alive = true;
    void fonts.ready.then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [fonts]);

  return ready;
}
