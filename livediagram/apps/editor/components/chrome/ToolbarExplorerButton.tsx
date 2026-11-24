'use client';

import type { Ref } from 'react';

import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { ToolbarMenuCard } from './ToolbarMenuCard';
import { Brand } from '@livediagram/ui';
import { explorerItemHref } from '@liveworkspace/workbench/lib/explorer-href';
import { useEditorInbox } from '@liveworkspace/workbench/components/chrome/useEditorInbox';
import { EditorModeSwitch } from './editor-mode/EditorModeSwitch';
import { ExplorerMenuButtons } from '@liveworkspace/workbench/components/chrome/phone-apps/ExplorerMenuButtons';

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
// where no switch is offered (a Participant, a Viewer, a locked tab, an event-storming board).
// The Inbox's count rides the button, and a new Inbox row shows as a notice under the corner card while the
// editor is open (liveworkspace/docs/specs/004-index/inbox-notices.md, docs/specs/013-workspace/inbox-notices.md).
export function ToolbarExplorerButton({
  open,
  onToggle,
  buttonRef,
  inline = false,
  itemId = null,
}: {
  open: boolean;
  // The open canvas, for the logo's link to the Explorer on the place that holds it.
  itemId?: string | null;
  inline?: boolean;
  // Given the button itself, which the popover anchors to.
  onToggle: (button: HTMLElement) => void;
  // The button itself: the Rename command opens the panel from it (useRenameCurrentRequest).
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  const phone = useIsMobileViewport();
  const inbox = useEditorInbox('livediagram');
  // The hamburger, or on a phone the logo and Apps (phone-apps-drawer.md), which then holds the logo itself.
  const button = (
    <ExplorerMenuButtons
      app="livediagram"
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
        <EditorModeSwitch iconOnly={phone || inline} />
        {/* No tab name here (owner, 2026-11-17): the tab bar names the tab. */}
      </ToolbarMenuCard>
      {inbox.notices}
    </>
  );
}
