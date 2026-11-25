'use client';

// A page whose content is still on its way (docs/specs/030-knowledgebase/page-surface.md "Switching pages"). The
// workbench's TabLoadOverlay covered the whole surface, the page tree, the top row and the rail with it, in an opaque
// sheet that flashed for a few frames on a page's first visit (Work Tracker 1465). Here the page area alone is held:
// the veil sits over the page's scroll container and under the chrome (which stays live), takes every press at once
// so nothing lands on the placeholder (the edits themselves are shut by `editsBlocked`), and shows its spinner only
// once the wait has lasted PAGE_LOAD_VEIL_DELAY_MS, so a quick load shows nothing at all. A failed load keeps the
// workbench's error card with its Retry.
import { useEffect, useState } from 'react';
import { Glyph } from '@liveworkspace/ui';

/** How long a page may take before its loader shows (ms). */
export const PAGE_LOAD_VEIL_DELAY_MS = 300;

export function PageLoadVeil() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), PAGE_LOAD_VEIL_DELAY_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      data-page-load-veil=""
      aria-busy="true"
      className={`absolute inset-0 z-[1] flex items-center justify-center ${
        shown
          ? 'bg-white motion-safe:transition-opacity motion-safe:duration-200 motion-safe:starting:opacity-0 dark:bg-slate-950'
          : ''
      }`}
    >
      {shown ? (
        <div role="status" className="flex flex-col items-center gap-3">
          <Glyph
            size={32}
            units={32}
            className="animate-spin text-brand-700 dark:text-brand-400"
            strokeLinejoin="miter"
          >
            <circle cx="16" cy="16" r="12" strokeOpacity="0.18" />
            <path d="M28 16a12 12 0 0 0-12-12" />
          </Glyph>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading page…</p>
        </div>
      ) : null}
    </div>
  );
}
