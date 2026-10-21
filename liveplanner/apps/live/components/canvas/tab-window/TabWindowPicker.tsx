'use client';

// The empty window's Choose a Tab list (docs/specs/009-elements/tab-window.md "Choosing the tab"), opened under its
// button. Loaded only when someone opens it, so the canvas's first load carries none of the menu.
import type { Tab } from '@liveplanner/document';
import { PortalMenu } from '@/components/primitives/PortalMenu';
import { TabWindowTabList } from './TabWindowTabList';

export function TabWindowPicker({
  anchor,
  tabs,
  ownTabId,
  shown,
  onPick,
  onClose,
}: {
  anchor: HTMLElement;
  tabs: readonly Tab[];
  ownTabId: string;
  shown: string | undefined;
  onPick: (tabId: string) => void;
  onClose: () => void;
}) {
  return (
    <PortalMenu anchor={anchor} placement="below" onClose={onClose} initialFocus="first">
      <TabWindowTabList tabs={tabs} ownTabId={ownTabId} shown={shown} onPick={onPick} />
    </PortalMenu>
  );
}
