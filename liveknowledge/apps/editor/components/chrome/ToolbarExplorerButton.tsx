'use client';

import { ExplorerMenuButtons } from '@liveworkspace/workbench/components/chrome/phone-apps/ExplorerMenuButtons';
import type { Ref } from 'react';
import { useEditorInbox } from '@liveworkspace/workbench/components/chrome/useEditorInbox';
import { ToolbarMenuCard } from '@liveworkspace/workbench/components/chrome/ToolbarMenuCard';
import { KnowledgeLogo, useOpenItemId } from './KnowledgeLogo';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';

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
// `inline`: in the top row, as a phone and a folded page tree put it (ToolbarMenuCard), the logo leading it.
// The Inbox's count rides the button, and a new Inbox row shows as a notice under the corner card while the
// editor is open (liveworkspace/docs/specs/004-index/inbox-notices.md, docs/specs/013-workspace/inbox-notices.md).
export function ToolbarExplorerButton({
  open,
  onToggle,
  buttonRef,
  inline = false,
  joinedWidth,
}: {
  open: boolean;
  inline?: boolean;
  // Heading Pages mode's docked Contents sidebar (ToolbarMenuCard).
  joinedWidth?: number;
  // Given the button itself, which the popover anchors to.
  onToggle: (button: HTMLElement) => void;
  // The button itself: the Rename command opens the panel from it (useRenameCurrentRequest).
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  const inbox = useEditorInbox('liveknowledge');
  const itemId = useOpenItemId();
  const phone = useIsMobileViewport();
  // The hamburger, or on a phone the logo and Apps (phone-apps-drawer.md), which then holds the logo itself.
  const button = (
    <ExplorerMenuButtons
      app="liveknowledge"
      open={open}
      onToggle={onToggle}
      buttonRef={buttonRef}
      itemId={itemId}
      inbox={inbox}
    />
  );
  return (
    <>
      {/* The shared card draws no logo inline; the top row keeps it, left of the menu button. On a phone the logo is
          the menu button itself (ExplorerMenuButtons). */}
      {inline && !phone ? <KnowledgeLogo className="mr-1 shrink-0" /> : null}
      <ToolbarMenuCard
        inline={inline}
        dockButton
        tourId="dock-explorer"
        {...(joinedWidth === undefined ? {} : { joinedWidth })}
        logo={
          // Heading the Contents sidebar the wordmark stays, the sidebar being as wide as ever.
          phone ? undefined : (
            <KnowledgeLogo wordmarkClassName="hidden lg:inline [[data-logo-in-band]_&]:inline" />
          )
        }
      >
        {/* No hover card: it got in the way of switching apps, and the aria-label names it. */}
        {button}
      </ToolbarMenuCard>
      {inbox.notices}
    </>
  );
}
