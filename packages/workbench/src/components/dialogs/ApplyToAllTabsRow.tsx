'use client';

// The foot of the Tab Style dialog's home (docs/specs/011-theme/canvas-and-theme-dialog.md "Apply to All Tabs" in
// each product): one grouped settings row, iOS style, that puts this tab's style on every tab of the document. An
// Editor's only; the dialog leaves it out for anyone else. With one tab there is nothing to align, so it shows nothing.
// The note names locked tabs only in an app that locks them (`tabLocks`, on unless the app says otherwise: livehuddle
// has no tab locks, livehuddle/docs/specs/011-theme/canvas-and-theme-dialog.md "Apply to All Tabs").
import { Glyph } from '@liveworkspace/ui';

export function ApplyToAllTabsRow({
  tabCount,
  applying,
  onApply,
  tabLocks = true,
}: {
  // Tabs in the document, this one included.
  tabCount: number;
  // Busy while the other tabs load and take the style.
  applying: boolean;
  onApply: () => void;
  // Whether this app can lock a tab. A locked tab keeps its own style, so the note says so; an app with no locks says
  // nothing about them.
  tabLocks?: boolean;
}) {
  if (tabCount < 2) return null;
  const others = tabCount - 1;
  const detail = applying
    ? 'Applying…'
    : `Give the other ${others === 1 ? 'tab' : `${others} tabs`} this tab's colours, finish, text and canvas.`;
  return (
    <section aria-label="All Tabs" className="flex flex-col gap-2">
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <button
          type="button"
          onClick={onApply}
          disabled={applying}
          aria-busy={applying || undefined}
          data-apply-all-tabs=""
          className="group flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[inherit] px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-slate-700/50"
        >
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-white group-disabled:bg-slate-300 dark:bg-brand-600 dark:group-disabled:bg-slate-600"
          >
            <AllTabsGlyph />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[13px] font-semibold text-brand-700 group-disabled:text-slate-500 dark:text-brand-300 dark:group-disabled:text-slate-400">
              Apply to All Tabs
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">{detail}</span>
          </span>
          {applying ? (
            <span
              aria-hidden
              className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500 motion-reduce:animate-none"
            />
          ) : null}
        </button>
      </div>
      <p className="px-3 text-[11px] text-slate-500 dark:text-slate-400">
        {tabLocks ? 'Locked tabs keep their own style. ' : ''}Undo puts every tab back.
      </p>
    </section>
  );
}

// Three tabs stacked, the front one filled: every tab at once.
function AllTabsGlyph() {
  return (
    <Glyph size={18} units={20}>
      <rect x="6" y="2.5" width="11.5" height="8.5" rx="1.5" />
      <path d="M4.25 5.5v6.75a1.5 1.5 0 0 0 1.5 1.5h9.5" />
      <path d="M2.5 8.5v6.75a1.5 1.5 0 0 0 1.5 1.5h9.5" />
    </Glyph>
  );
}
