'use client';

import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { useState } from 'react';
import { Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideX } from '@liveplanner/icons/lucide';
import { useEditorModeState } from '@/components/chrome/editor-mode/editor-mode-context';
import { EmptyCanvasArt } from './EmptyCanvasArt';
import { dismissEmptyCard, emptyCardDismissed } from './empty-card-dismissed';

const CloseGlyph = lucideGlyph(lucideX, 16);

// The empty-canvas card (docs/specs/007-editor/new-document-route.md "The empty-canvas hint"), shown while the active
// tab has no elements: a calm card in the middle of the canvas, as Start Planning and an empty page's own start sit
// in theirs, saying the tab is empty and offering Help (an Editor's, on a desktop). Only the card takes presses: the
// canvas around it still pans, and a palette tool still places. It goes once the tab has content (or a draw tool is
// engaged), and its × closes it for good on that tab, for this person (empty-card-dismissed.ts). A viewer reads a
// passive line instead; a Participant is pointed at what they may add. An Editor's empty tab shows its mode's start
// instead (start-diagramming.md), where its templates are.

export function EmptyCanvasBanner({
  tabId,
  tabName,
  readOnly,
  participant = false,
}: {
  tabId: string;
  tabName: string;
  readOnly: boolean;
  // A Participant (docs/specs/013-workspace/share-roles.md): read-only, yet it adds stickies, text and images.
  participant?: boolean;
}) {
  // The picture is of what the tab's mode makes (Diagram when no mode is known).
  const mode = useEditorModeState()?.mode ?? 'diagram';
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
        <Tooltip label="Close">
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
        </Tooltip>
        {/* A short screen (a phone on its side, 390px tall) drops the art, so the card clears the
            toolbars above and below it instead of sliding under the Palette strip. */}
        <div className="[@media(max-height:480px)]:hidden">
          <EmptyCanvasArt mode={mode} />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">
            {tabName} is empty
          </p>
          <p className="text-[13px] leading-snug text-slate-500 dark:text-slate-400">
            {participant
              ? 'Nothing here yet. Add a sticky, text or an image from the Palette to get it going.'
              : readOnly
                ? 'Nothing here yet. The owner can build it out, and your view updates live.'
                : 'Add an element from the Palette to get it going.'}
          </p>
        </div>
        {readOnly ? null : (
          // Help is a desktop's: on a phone the help centre is a tap away in the Explorer.
          <div className="mt-1 flex items-center gap-2 phone:hidden">
            <HelpArticleLink article="yourFirstDiagram" variant="button" />
          </div>
        )}
      </div>
    </div>
  );
}
