'use client';

import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { Button } from '@livediagram/ui';
import { useEditorModeState } from '@/components/chrome/editor-mode/editor-mode-context';
import { EmptyCanvasArt } from './EmptyCanvasArt';

// The empty-canvas card (docs/specs/007-editor/new-document-route.md "The empty-canvas hint"), shown while the active
// tab has no elements: a calm card in the middle of the canvas, as Start Planning and an empty page's own start sit
// in theirs, saying the tab is empty and offering Quick Start (an Editor's) and Help. Only the card takes presses: the
// canvas around it still pans, and a palette tool still places. Not dismissible: it goes once the tab has content (or
// a draw tool or Quick Start is engaged). A viewer reads a passive line instead; a Participant is pointed at what
// they may add.

export function EmptyCanvasBanner({
  tabName,
  readOnly,
  participant = false,
  onQuickStart,
}: {
  tabName: string;
  readOnly: boolean;
  // A Participant (docs/specs/013-workspace/share-roles.md): read-only, yet it adds stickies, text and images.
  participant?: boolean;
  onQuickStart: () => void;
}) {
  // The picture is of what the tab's mode makes (Diagram when no mode is known).
  const mode = useEditorModeState()?.mode ?? 'diagram';
  return (
    // At the canvas's own layer, beneath the toolbars and panels: a palette's More popover or a panel opened over the
    // middle of the canvas sits in front of the card, never under it.
    <div className="pointer-events-none fixed inset-0 z-[var(--z-panel)] flex items-center justify-center px-4">
      <div
        role="region"
        aria-label={`${tabName} is empty`}
        className="pointer-events-auto flex w-full max-w-sm animate-fly-up-in flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-6 py-6 text-center shadow-lg shadow-slate-900/5 backdrop-blur phone:max-w-[18rem] phone:gap-2.5 phone:px-5 phone:py-5 dark:border-slate-700 dark:bg-slate-900/95"
      >
        <EmptyCanvasArt mode={mode} />
        <div className="flex flex-col gap-1">
          <p className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">
            {tabName} is empty
          </p>
          <p className="text-[13px] leading-snug text-slate-500 dark:text-slate-400">
            {participant
              ? 'Nothing here yet. Add a sticky, text or an image from the Palette to get it going.'
              : readOnly
                ? 'Nothing here yet. The owner can build it out, and your view updates live.'
                : 'Add an element from the Palette, or start from a template.'}
          </p>
        </div>
        {readOnly ? null : (
          <div className="mt-1 flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={onQuickStart}>
              Quick Start
            </Button>
            {/* Help is a desktop's: on a phone the help centre is a tap away in the Explorer. */}
            <span className="contents phone:hidden">
              <HelpArticleLink article="yourFirstDiagram" variant="button" />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
