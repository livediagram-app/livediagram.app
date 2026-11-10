'use client';

// The phone's way round the Explorer (liveworkspace/docs/specs/004-index/one-explorer.md "The sidebar", On a phone):
// below `sm` the sidebar folds into a drawer, and the sections bar under the page's header is the one way in. The
// bar is a single full-width button naming the view on screen; the Explorer stacks it in one sticky block with the
// header, so the two stay at the top together with no scroll listener. The drawer it opens takes the whole screen.

import { useEffect, useRef } from 'react';
import {
  DialogCloseButton,
  safeInlinePadding,
  safeInset,
  useEscape,
  useFocusTrap,
} from '@liveworkspace/ui';
import { ChevronRightIcon, HamburgerIcon } from '../ui/icons';
import { FOCUS_RING_INSET } from '../ui/classes';
import { useExplorer } from './context';
import { Sidebar } from './Sidebar';
import { viewTitle } from './view-title';
import { useHostExtras } from './host';
import { useThisBrowserFolders } from './ThisBrowser';

export const SECTIONS_COPY = {
  // The drawer's name, and the word the bar's name opens with.
  sidebar: 'Menu',
  open: (current: string) => `Open Menu, Current: ${current}`,
} as const;

// Marks the bar, for whatever hands focus back to it (TeamPane's landOnMyWork).
export const SECTIONS_BAR_ATTR = 'data-sections-bar';

// The bar's own side padding (the page's 16px gutter), cleared of a landscape notch.
const GUTTER = safeInlinePadding('1rem');

/** The full-width bar under the header on a phone: the menu glyph, the view's name and a chevron, one button. */
export function SectionsBar({
  open,
  drawerId,
  onOpen,
}: {
  open: boolean;
  drawerId: string;
  onOpen: () => void;
}) {
  const { view, folders, teamName, app } = useExplorer();
  const { thisBrowser } = useHostExtras();
  const localFolders = useThisBrowserFolders(thisBrowser && view.kind === 'offline' ? app : null);
  const current = viewTitle(view, folders, teamName, localFolders);
  return (
    <div className="border-b border-slate-200/70 bg-white/85 backdrop-blur sm:hidden dark:border-slate-800/70 dark:bg-slate-950/85">
      <button
        type="button"
        {...{ [SECTIONS_BAR_ATTR]: '' }}
        onClick={onOpen}
        aria-expanded={open}
        aria-controls={drawerId}
        aria-haspopup="dialog"
        aria-label={SECTIONS_COPY.open(current)}
        style={GUTTER}
        className={`flex h-12 w-full cursor-pointer items-center gap-3 text-left text-slate-900 transition-colors hover:bg-slate-100/70 active:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800/50 dark:active:bg-slate-800/70 ${FOCUS_RING_INSET}`}
      >
        <span aria-hidden className="flex shrink-0 text-slate-500 dark:text-slate-400">
          <HamburgerIcon />
        </span>
        <span
          data-sections-bar-title=""
          className="min-w-0 flex-1 truncate text-[15px] font-semibold"
        >
          {current}
        </span>
        <span aria-hidden className="flex shrink-0 text-slate-400 dark:text-slate-500">
          <ChevronRightIcon size={14} />
        </span>
      </button>
    </div>
  );
}

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
        <DialogCloseButton onClick={onClose} compact />
      </div>
      <div style={GUTTER} className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-3">
        <Sidebar />
      </div>
    </div>
  );
}
