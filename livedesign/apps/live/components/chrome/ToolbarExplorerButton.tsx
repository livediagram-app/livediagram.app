'use client';

import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { ExplorerMenuButtons } from '@liveworkspace/workbench/components/chrome/phone-apps/ExplorerMenuButtons';
import type { Ref } from 'react';

import { Brand } from '@livedesign/ui';
import { explorerItemHref } from '@liveworkspace/workbench/lib/explorer-href';
import { useEditorInbox } from '@liveworkspace/workbench/components/chrome/useEditorInbox';
import { useOptionalEditorContext } from '@/app/design/[id]/EditorContext';
import { ToolbarMenuCard } from '@liveworkspace/workbench/components/chrome/ToolbarMenuCard';

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
  // The open design: the logo opens the Explorer on the place that holds it (at its root with no editor around it).
  const itemId = useOptionalEditorContext()?.designId ?? null;
  const inbox = useEditorInbox('livedesign');
  const phone = useIsMobileViewport();
  // The hamburger, or on a phone the logo and Apps (phone-apps-drawer.md), which then holds the logo itself.
  const button = (
    <ExplorerMenuButtons
      app="livedesign"
      open={open}
      onToggle={onToggle}
      buttonRef={buttonRef}
      itemId={itemId}
      inbox={inbox}
    />
  );
  return (
    <>
      <ToolbarMenuCard
        inline={inline}
        dockButton
        tourId="dock-explorer"
        {...(joinedWidth === undefined ? {} : { joinedWidth })}
        logo={
          phone ? undefined : (
          <Brand
            href={explorerItemHref(itemId)}
            size="sm"
            // Heading the Contents sidebar the wordmark stays, the sidebar being as wide as ever.
            wordmarkClassName="hidden lg:inline [[data-logo-in-band]_&]:inline"
            className="relative touch-target"
          />
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
