'use client';

// The empty-canvas card every editor shares (liveworkspace/docs/specs/011-workbench/first-edit.md "The empty-canvas
// card"): a calm card in the middle of an empty tab, the product's small picture, "<Tab> is empty" and one line. Only
// the card takes presses: the canvas around it still pans, and a palette tool still places. It goes once the tab has
// content (the product stops rendering it), and its × closes it for good on that tab, for this person in this browser
// (empty-card-dismissed.ts). A Participant or Viewer sees it; an Editor's empty tab shows the product's start instead.
import { useState, type ReactNode } from 'react';
import { lucideGlyph } from '@liveworkspace/ui';
import { lucideX } from '@liveworkspace/icons/lucide';
import { dismissEmptyCard, emptyCardDismissed } from './empty-card-dismissed';

const CloseGlyph = lucideGlyph(lucideX, 16);

/** A Viewer's line, the same in every editor. */
export const EMPTY_CARD_VIEWER_LINE =
  'Nothing here yet. The owner can build it out, and your view updates live.';

export function EmptyCanvasCard({
  tabId,
  tabName,
  line,
  art,
  help,
}: {
  tabId: string;
  tabName: string;
  // The one line under the title, shown in full.
  line: string;
  // The product's picture of what it makes (decorative); dropped on a short screen.
  art: ReactNode;
  // Help, a desktop's (an Editor's card only).
  help?: ReactNode;
}) {
  // Read once: the card is keyed by its tab, so another tab reads afresh.
  const [closed, setClosed] = useState(() => emptyCardDismissed(tabId));
  if (closed) return null;
  return (
    // At the canvas's own layer, beneath the toolbars and panels: a palette's More popover or a panel opened over the
    // middle of the canvas sits in front of the card, never under it.
    <div className="pointer-events-none fixed inset-0 z-[var(--z-panel)] flex items-center justify-center px-4">
      <div
        role="region"
        aria-label={`${tabName} is empty`}
        className="pointer-events-auto relative flex w-full max-w-sm animate-fly-up-in flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-6 py-6 text-center shadow-lg shadow-slate-900/5 backdrop-blur phone:max-w-[18rem] phone:gap-2.5 phone:px-5 phone:py-5 dark:border-slate-700 dark:bg-slate-900/95"
      >
        <button
          type="button"
          aria-label="Close"
          className="touch-target absolute right-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          onClick={() => {
            dismissEmptyCard(tabId);
            setClosed(true);
          }}
        >
          <CloseGlyph />
        </button>
        {/* A short screen (a phone on its side, 390px tall) drops the art, so the card clears the
            toolbars above and below it instead of sliding under the Palette strip. */}
        <div className="[@media(max-height:480px)]:hidden">{art}</div>
        <div className="flex flex-col gap-1">
          <p className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">
            {tabName} is empty
          </p>
          <p className="text-[13px] leading-snug text-slate-500 dark:text-slate-400">{line}</p>
        </div>
        {help ? (
          // Help is a desktop's: on a phone the help centre is a tap away in the Explorer.
          <div className="mt-1 flex items-center gap-2 phone:hidden">{help}</div>
        ) : null}
      </div>
    </div>
  );
}

/** The card's picture frame: a soft brand-tinted panel, 120 by 72, holding a product's scene. */
export function EmptyCanvasArtFrame({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden viewBox="0 0 120 72" className="h-[72px] w-[120px]" fill="none">
      <rect
        x="1"
        y="1"
        width="118"
        height="70"
        rx="12"
        fill="color-mix(in srgb, var(--color-brand-500) 14%, transparent)"
      />
      {children}
    </svg>
  );
}
