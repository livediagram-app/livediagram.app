'use client';

// The phone's way round the Explorer (liveworkspace/docs/specs/004-index/one-explorer.md "The sidebar", On a phone):
// below `sm` the sidebar folds into a drawer, and the sections bar under the page's header is the one way in. The
// bar is a single full-width button naming the view on screen; the Explorer stacks it in one sticky block with the
// header, so the two stay at the top together with no scroll listener. The drawer it opens (SectionsDrawer.tsx, from its own chunk) takes the whole screen.

import { safeInlinePadding } from '@liveworkspace/ui';
import { ChevronRightIcon, HamburgerIcon } from '../ui/icons';
import { FOCUS_RING_INSET } from '../ui/classes';
import { useExplorer } from './context';
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
export const GUTTER = safeInlinePadding('1rem');

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
        className={`flex h-12 w-full cursor-pointer items-center gap-3 text-left text-slate-900 transition-colors hover:bg-slate-100/70 active:bg-slate-100 active:hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800/50 dark:active:bg-slate-800/70 dark:active:hover:bg-slate-800/70 ${FOCUS_RING_INSET}`}
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
