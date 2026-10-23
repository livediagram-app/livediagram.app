'use client';

// An empty page's invitation where its layout card has no room on screen (docs/specs/007-editor/
// pages-mode.md "An empty page offers its layouts"): a phone, or a page zoomed out small. One
// Choose a Layout button in the page's middle, held at one screen size whatever the zoom, that
// opens the page's panel on its Layouts (a bottom sheet on a phone) with the whole gallery.
import { lucideSparkles } from '@livedocuments/icons/lucide';
import { lucideGlyph } from '@livedocuments/ui';

const SparklesIcon = lucideGlyph(lucideSparkles, 15);

export function EmptyPageInvite({
  pageId,
  zoom,
  onOpen,
}: {
  pageId: string;
  zoom: number;
  onOpen: () => void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <button
        type="button"
        data-empty-page-invite={pageId}
        // A press on it is its own, never the canvas's (no marquee, no deselect).
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onClick={onOpen}
        className="touch-target pointer-events-auto relative flex animate-dialog-in items-center gap-2 whitespace-nowrap rounded-full bg-brand-700 py-2 pl-3 pr-4 text-sm font-semibold text-white shadow-lg shadow-brand-900/25 ring-4 ring-white/70 transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:bg-brand-600 dark:ring-slate-900/70 dark:hover:bg-brand-500"
        style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'center' }}
      >
        <SparklesIcon />
        Choose a Layout
      </button>
    </div>
  );
}
