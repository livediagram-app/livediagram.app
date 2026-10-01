'use client';

import { track } from '@/lib/telemetry';
import { HoverCard, Glyph } from '@livediagram/ui';
import { useUiScale } from '@/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@/lib/ui-scale';

// The Toolbar layout's menu button (docs/specs/007-editor/toolbar-layout.md), top-left of the canvas where
// the Explorer panel would float. It toggles that same Explorer panel open as
// a popover hanging under it, through the dock's popover path (it hands
// itself to the toggle as the anchor), so it is the real Explorer, not a
// second menu that could drift from it.
//
// `data-mobile-dock` is what MovablePanel's outside-click check skips, so
// pressing this button while the Explorer is open closes it via the toggle
// rather than closing it on pointer-down and reopening it on click.
//
// `inline` drops the corner card so the button can sit at the far left of
// the Palette strip instead, which is where a phone puts it.
export function ToolbarExplorerButton({
  open,
  onToggle,
  inline = false,
}: {
  open: boolean;
  inline?: boolean;
  // Given the button itself, which the popover anchors to.
  onToggle: (button: HTMLElement) => void;
}) {
  // Drawn at the UI scale (docs/specs/007-editor/ui-scale.md), still 12px from
  // the corner. Inline it sits in the strip, which is scaled already.
  const scale = useUiScale();
  const scaled = !inline && scale !== 1;
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
      <Glyph size={18} units={20} strokeLinejoin="miter">
        <path d="M4 6h12M4 10h12M4 14h12" />
      </Glyph>
    </button>
  );
  return (
    <div
      data-mobile-dock=""
      data-tour-id="dock-explorer"
      data-toolbar-menu=""
      style={
        scaled
          ? { ...uiScaleStyle(scale), top: toSurfacePx(12, scale), left: toSurfacePx(12, scale) }
          : undefined
      }
      className={
        inline
          ? 'flex'
          : 'pointer-events-auto absolute left-3 top-3 z-[var(--z-toolbar)] rounded-xl border border-slate-200 bg-white p-1 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40'
      }
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* No hover card while open: it would sit over the panel it names. */}
      {open ? (
        button
      ) : (
        <HoverCard title="Explorer" description="Your documents, folders and teams.">
          {button}
        </HoverCard>
      )}
    </div>
  );
}
