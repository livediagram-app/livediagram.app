'use client';

// The phone's sidebar drawer (PhoneSections.tsx has the bar that opens it), from its own chunk (lazy-panes.ts): only a
// tap on the bar draws it, so its dialog close and focus trap stay out of the Explorer's first load. The Explorer
// fetches it once the page is idle, and the bar as a press starts, so the drawer rises with the tap.

import { useEffect, useRef } from 'react';
import { DialogCloseButton, safeInset, useEscape, useFocusTrap } from '@liveworkspace/ui';
import { Sidebar } from './Sidebar';
import { GUTTER, SECTIONS_COPY } from './PhoneSections';

/** Stops the page scrolling behind an open drawer, and hands it back as it was when the drawer closes. */
function useScrollLock() {
  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = before;
    };
  }, []);
}

/** The sidebar on a phone: the whole screen, on the page's own ground (so its rows look as they do beside the pane),
 *  sliding in from the left, its name and close on top. */
export function SectionsDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  // Focus goes to the panel once, as it opens, stays inside while it is open and goes back to the bar when it
  // closes. Escape reads the latest onClose: keyed on it, as a fresh arrow each render, the panel took focus back
  // from whatever row was focused every time the Explorer rendered.
  useFocusTrap(panel, true, 'container');
  useEscape(onClose, { preventDefault: true });
  useScrollLock();
  return (
    <div
      ref={panel}
      id={id}
      role="dialog"
      aria-modal="true"
      aria-label={SECTIONS_COPY.sidebar}
      tabIndex={-1}
      data-sections-drawer=""
      style={{ paddingTop: safeInset('top'), paddingBottom: safeInset('bottom') }}
      className="lw-drawer-in fixed inset-0 z-50 flex w-full flex-col bg-slate-50 outline-none sm:hidden dark:bg-slate-950"
    >
      <div
        style={GUTTER}
        className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 dark:border-slate-800/70"
      >
        <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {SECTIONS_COPY.sidebar}
        </span>
        <DialogCloseButton onClick={onClose} />
      </div>
      <div style={GUTTER} className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-3">
        <Sidebar />
      </div>
    </div>
  );
}
