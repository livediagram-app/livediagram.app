'use client';

import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { ExplorerMenuButtons } from '@liveworkspace/workbench/components/chrome/phone-apps/ExplorerMenuButtons';
import type { Ref } from 'react';

import { Brand } from '@livehuddle/ui';
import { explorerItemHref } from '@liveworkspace/workbench/lib/explorer-href';
import { useOptionalEditorContext } from '@/app/document/[id]/EditorContext';
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
//
// The editor mode switch (docs/specs/007-editor/editor-modes.md "The mode switch") rides right of the button in the
// same card, so it goes wherever the menu goes: named on a computer, its icon alone on a phone. It renders nothing
// where no switch is offered (a Participant, a Viewer).
export function ToolbarExplorerButton({
  open,
  onToggle,
  buttonRef,
  inline = false,
}: {
  open: boolean;
  inline?: boolean;
  // Given the button itself, which the popover anchors to.
  onToggle: (button: HTMLElement) => void;
  // The button itself: the Rename command opens the panel from it (useRenameCurrentRequest).
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  // The open space: the logo opens the Explorer on the place that holds it (at its root with no editor around it).
  const itemId = useOptionalEditorContext()?.documentId ?? null;
  const phone = useIsMobileViewport();
  // The hamburger, or on a phone the logo and Apps (phone-apps-drawer.md), which then holds the logo itself.
  const button = (
    <ExplorerMenuButtons
      app="livehuddle"
      open={open}
      onToggle={onToggle}
      buttonRef={buttonRef}
      itemId={itemId}
    />
  );
  return (
    <ToolbarMenuCard
      inline={inline}
      dockButton
      tourId="dock-explorer"
      logo={
        phone ? undefined : (
        <Brand
          href={explorerItemHref(itemId)}
          size="sm"
          wordmarkClassName="hidden lg:inline"
          className="relative touch-target"
        />
        )
      }
    >
      {/* No hover card: it got in the way of switching apps, and the aria-label names it. */}
      {button}
    </ToolbarMenuCard>
  );
}
