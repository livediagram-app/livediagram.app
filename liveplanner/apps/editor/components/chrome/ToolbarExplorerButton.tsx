'use client';

import { track } from '@/lib/telemetry';
import { HoverCard, Glyph } from '@liveplanner/ui';
import { useUiScale } from '@/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@/lib/ui-scale';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { MenuNameSlot, TabNameInBox } from '@/components/plan/menu-name-slot';
import { BAND_BLEND, BAND_FLUSH, BAND_TINT } from './toolbar-surface';
import { PHONE_TOOLBAR_ITEMS } from './phone-toolbar-items';

// The Toolbar layout's menu button (docs/specs/007-editor/toolbar-layout.md), top-left of the canvas where
// the Explorer panel would float. It toggles that same Explorer panel open as
// a popover hanging under it, through the dock's popover path (it hands
// itself to the toggle as the anchor), so it is the real Explorer, not a
// second menu that could drift from it.
//
// `data-dock-button` is what MovablePanel's outside-click check skips, so
// pressing this button while the Explorer is open closes it via the toggle
// rather than closing it on pointer-down and reopening it on click.
//
// `inline` drops the corner positioning so the strip's row can hold it in its
// own card at the far left, beside the strip, which is where a phone puts it.
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
  const scale = useUiScale('toolbar');
  const scaled = !inline && scale !== 1;
  const phone = useIsMobileViewport();
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
      data-dock-button=""
      // Chrome, not canvas: the canvas's capture-phase gestures skip a press inside a floating
      // panel. Without it, a press here with a Draw pen in hand started a stroke instead.
      data-floating-panel=""
      data-tour-id="dock-explorer"
      data-toolbar-menu=""
      style={
        scaled
          ? { ...uiScaleStyle(scale), top: toSurfacePx(12, scale), left: toSurfacePx(12, scale) }
          : undefined
      }
      className={
        inline
          ? 'flex items-center gap-1'
          : `pointer-events-auto absolute left-3 top-3 z-[var(--z-toolbar)] flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40 ${BAND_TINT} ${BAND_BLEND} ${BAND_FLUSH} ${PHONE_TOOLBAR_ITEMS}`
      }
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* No hover card while open: it would sit over the panel it names. Disabled, not unwrapped, so the
          button keeps its focus as the panel opens. */}
      <HoverCard title="Explorer" description="Your plans, folders and teams." disabled={open}>
        {button}
      </HoverCard>
      {/* A maximised or tab-filling element's name, while its header holds the top row (menu-name-slot). */}
      {phone || inline ? null : <MenuNameSlot />}
      {/* Else the open tab's name, in every mode (not on a phone). */}
      {phone || inline ? null : <TabNameInBox />}
    </div>
  );
}
