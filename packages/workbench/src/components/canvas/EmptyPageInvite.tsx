'use client';

// An empty page's invitation to start from a layout, in the page's middle (livedocuments' "Use a Layout",
// docs/specs/007-editor/pages-mode.md "An empty page offers a layout, quietly"; livedesign's "Choose a Layout"
// where its layout card has no room, "An empty page offers its layouts"). A soft card, held at one screen size
// whatever the zoom: a brand tile with the layouts glyph, the invite's name, and a muted line under it. It rises
// in as the page appears (a fade alone under reduced motion) and lifts a little on hover. What a press opens is
// the editor's.
import { lucidePanelsTopLeft } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveworkspace/ui';

const LayoutsIcon = lucideGlyph(lucidePanelsTopLeft, 18);

export function EmptyPageInvite({
  pageId,
  zoom,
  onOpen,
  label = 'Choose a Layout',
  hint = 'Start from a ready-made page',
}: {
  pageId: string;
  zoom: number;
  onOpen: () => void;
  // Its name (the button's accessible name too) and the muted line under it.
  label?: string;
  hint?: string;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {/* Held at its screen size: the counter-scale is the wrapper's, so the entrance and the hover lift
          (the button's own transforms) never fight it. */}
      <div style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'center' }}>
        <button
          type="button"
          aria-label={label}
          data-empty-page-invite={pageId}
          // A press on it is its own, never the canvas's (no marquee, no deselect).
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onClick={onOpen}
          // No backdrop filter, as the page title bar (PageTitleBar.tsx).
          className="group touch-target pointer-events-auto relative flex animate-dialog-in cursor-pointer items-center gap-3 whitespace-nowrap rounded-2xl border border-slate-200/90 bg-white/95 py-2.5 pl-2.5 pr-5 text-left shadow-[0_1px_2px_rgb(15_23_42/0.06),0_8px_24px_-8px_rgb(15_23_42/0.18)] transition-[translate,box-shadow,border-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_2px_4px_rgb(15_23_42/0.06),0_14px_32px_-10px_rgb(15_23_42/0.25)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-slate-700/80 dark:bg-slate-900/95 dark:hover:border-brand-500/50"
        >
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white shadow-sm shadow-brand-900/25 transition-transform duration-150 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100 dark:bg-brand-600"
          >
            <LayoutsIcon />
          </span>
          <span aria-hidden className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {label}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span>
          </span>
        </button>
      </div>
    </div>
  );
}
