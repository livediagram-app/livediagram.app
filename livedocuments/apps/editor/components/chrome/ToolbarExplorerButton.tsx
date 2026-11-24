'use client';

import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { ExplorerMenuButtons } from '@liveworkspace/workbench/components/chrome/phone-apps/ExplorerMenuButtons';
import { Brand } from '@livedocuments/ui';
import { useContext, useSyncExternalStore, type Ref } from 'react';
import { EditorChromeContext } from '@/app/document/[id]/EditorContext';
import { explorerItemHref } from '@liveworkspace/workbench/lib/explorer-href';
import { useEditorInbox } from '@liveworkspace/workbench/components/chrome/useEditorInbox';
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
  // The open document: the logo opens the Explorer on the place that holds it.
  // Read without requiring the editor's store, so the button renders on its own (its tests, a workbench) with the
  // logo opening the Explorer at its root.
  const store = useContext(EditorChromeContext);
  const itemId = useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => store?.get().documentId ?? null,
    () => null,
  );
  const inbox = useEditorInbox('livedocuments');
  const phone = useIsMobileViewport();
  // The hamburger, or on a phone the logo and Apps (phone-apps-drawer.md), which then holds the logo itself.
  const button = (
    <ExplorerMenuButtons
      app="livedocuments"
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

const noSubscribe = () => () => {};
