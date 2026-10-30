'use client';

import { track } from '@/lib/telemetry';
import { Glyph } from '@livedesign/ui';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { TabNameInBox } from '@liveworkspace/workbench/components/chrome/TabNameInBox';
import { NAME_MAX_LENGTH } from '@livedesign/design';
import { ToolbarMenuCard } from './ToolbarMenuCard';

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
// `inline`: in the strip's row, as a phone puts it (ToolbarMenuCard).
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
    <ToolbarMenuCard inline={inline} dockButton tourId="dock-explorer">
      {/* No hover card: it got in the way of switching apps, and the aria-label names it. */}
      {button}
      {/* The open tab's name (not on a phone). */}
      {phone || inline ? null : <TabNameInBox maxLength={NAME_MAX_LENGTH} />}
    </ToolbarMenuCard>
  );
}
