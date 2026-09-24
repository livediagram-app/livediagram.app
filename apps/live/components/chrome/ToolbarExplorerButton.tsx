'use client';

import { track } from '@/lib/telemetry';
import { Tooltip } from '@/components/primitives/Tooltip';

// The Toolbar layout's menu button (spec/148), top-left of the canvas where
// the Explorer panel would float. It toggles that same Explorer panel open as
// a popover hanging under it, through the dock's popover path (it hands
// itself to the toggle as the anchor), so it is the real Explorer, not a
// second menu that could drift from it.
//
// `data-mobile-dock` is what MovablePanel's outside-click check skips, so
// pressing this button while the Explorer is open closes it via the toggle
// rather than closing it on pointer-down and reopening it on click.
export function ToolbarExplorerButton({
  open,
  onToggle,
}: {
  open: boolean;
  // Given the button itself, which the popover anchors to.
  onToggle: (button: HTMLElement) => void;
}) {
  const button = (
    <button
      type="button"
      aria-label="Explorer"
      aria-expanded={open}
      onClick={(e) => {
        if (!open) track('UI', 'Opened', 'ToolbarExplorer');
        onToggle(e.currentTarget);
      }}
      className={`flex h-9 w-9 items-center justify-center rounded-md transition ${
        open
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        aria-hidden
      >
        <path d="M4 6h12M4 10h12M4 14h12" />
      </svg>
    </button>
  );
  return (
    <div
      data-mobile-dock=""
      data-toolbar-menu=""
      className="pointer-events-auto absolute left-3 top-3 z-[var(--z-toolbar)] hidden rounded-xl border border-slate-200 bg-white p-1 shadow-md shadow-slate-900/5 sm:block dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* No tooltip while open: it would sit over the panel it names. */}
      {open ? (
        button
      ) : (
        <Tooltip title="Explorer" description="Your diagrams, folders and teams.">
          {button}
        </Tooltip>
      )}
    </div>
  );
}
