'use client';

// The tabs a window may show (docs/specs/009-elements/tab-window.md "Choosing the tab"): every tab of the document but
// the window's own, in tab-bar order, each by name, the shown one marked. Shared by the empty window's Choose a Tab and
// the menu's Tab Window section.
import { tabWindowOffers, type Tab } from '@livedocuments/document';
import { CompactEmptyState, lucideGlyph } from '@livedocuments/ui';
import { lucideAppWindow } from '@livedocuments/icons/lucide';
import { OptionRows } from '@/components/primitives/OptionRows';

const WindowIcon = lucideGlyph(lucideAppWindow, 16);

export function TabWindowTabList({
  tabs,
  ownTabId,
  shown,
  onPick,
}: {
  tabs: readonly Tab[];
  ownTabId: string;
  shown: string | undefined;
  onPick: (tabId: string) => void;
}) {
  const offers = tabWindowOffers(tabs, ownTabId);
  if (offers.length === 0)
    return (
      <CompactEmptyState
        size="small"
        icon={<WindowIcon />}
        title="No other tab to show yet."
        description="Add a tab and draw on it; a window shows it here."
      />
    );
  return (
    <OptionRows
      kind="single"
      selected={shown ?? null}
      label="Tabs"
      className="mx-1 my-1"
      rows={offers.map((t) => ({
        id: t.id,
        label: t.name || 'Untitled tab',
      }))}
      onPick={onPick}
    />
  );
}
