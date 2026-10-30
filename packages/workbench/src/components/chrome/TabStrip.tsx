'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { scrollLeftToReveal, TAB_REVEAL_PAD } from './tab-strip-scroll';
import { TAB_ADD_CLASS, TAB_LIST_CLASS, TAB_STRIP_CLASS } from './tab-shape';
import { TabFolderGroup, type TabFolderGroupProps } from './TabFolderGroup';

// The footer's tab strip, shared by every editor (docs/specs/007-editor/editor-app.md "Tab bar", "How a tab looks";
// docs/specs/006-document/tab-folders.md "Tab bar rendering"): the scroller, the `tablist` of tabs and folders, Add
// tab, which folders are open this visit, the arrow keys, and keeping the open tab in view.

export type TabRun<T> = { kind: 'loose'; tab: T } | { kind: 'folder'; name: string; tabs: T[] };

export type TabStripProps<T extends { id: string }> = {
  runs: TabRun<T>[];
  activeId: string;
  readOnly: boolean;
  // One tab, rendered by the app (its TabFrame, or its Not shared tab).
  renderTab: (tab: T) => ReactNode;
  // Add tab, after the last tab; omitted for a Viewer.
  onAdd?: () => void;
  // A tab dropped on a folder's chip joins it at its head (placed before its first member).
  onReorder: (sourceId: string, targetId: string, placeBefore?: boolean) => void;
  onRenameFolder: (oldName: string, newName: string) => void;
  renderRenameField: TabFolderGroupProps<T>['renderRenameField'];
  // Presence on a collapsed folder's tucked-away members.
  folderPresence?: (tabIds: string[]) => ReactNode;
};

const still = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

export function TabStrip<T extends { id: string }>({
  runs,
  activeId,
  readOnly,
  renderTab,
  onAdd,
  onReorder,
  onRenameFolder,
  renderRenameField,
  folderPresence,
}: TabStripProps<T>) {
  const stripRef = useRef<HTMLDivElement>(null);

  // Which folders are open: this visit's own, never stored or broadcast. Every folder starts collapsed.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggleFolder = useCallback((name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(name)) next.add(name);
      return next;
    });
  }, []);
  // A renamed folder stays as open or shut as it was.
  const renameFolder = useCallback(
    (oldName: string, newName: string) => {
      setExpanded((prev) => {
        if (!prev.has(oldName)) return prev;
        const next = new Set(prev);
        next.delete(oldName);
        next.add(newName);
        return next;
      });
      onRenameFolder(oldName, newName);
    },
    [onRenameFolder],
  );

  // Scroll the least distance that shows [left, right] (screen px), clear of the edge fade.
  const reveal = useCallback((left: number, right: number) => {
    const strip = stripRef.current;
    if (!strip) return;
    const s = strip.getBoundingClientRect();
    const to = scrollLeftToReveal(
      { left: s.left, right: s.right, scrollLeft: strip.scrollLeft },
      { left, right },
    );
    if (to !== strip.scrollLeft) strip.scrollTo({ left: to, behavior: still() ? 'auto' : 'smooth' });
  }, []);

  // The open tab is always in view: a tab added to a full strip, or picked from the Tabs list, used to open past the
  // strip's edge. Measures the whole tab, its menu button and avatars included; the last tab brings Add tab with it.
  // Runs when the open tab or the number of tabs changes, and on a tap on the open tab, never on a timer.
  const tabIds = runs.flatMap((r) => (r.kind === 'loose' ? [r.tab.id] : r.tabs.map((t) => t.id)));
  const tabCount = tabIds.length;
  const lastTabId = tabIds.at(-1);
  const revealActive = useCallback(() => {
    const strip = stripRef.current;
    const tab = strip?.querySelector<HTMLElement>('[data-tab][data-active]');
    if (!strip || !tab) return;
    const t = tab.getBoundingClientRect();
    const add = activeId === lastTabId ? strip.querySelector('[data-tour-id="add-tab"]') : null;
    reveal(t.left, add ? add.getBoundingClientRect().right : t.right);
  }, [activeId, lastTabId, reveal]);
  useEffect(revealActive, [revealActive, tabCount]);

  // A folder that opens past the edge comes into view, chip first when it is wider than the strip.
  const revealGroup = useCallback(
    (group: HTMLElement) => {
      const strip = stripRef.current;
      if (!strip) return;
      const g = group.getBoundingClientRect();
      const room = strip.getBoundingClientRect().width - 2 * TAB_REVEAL_PAD;
      reveal(g.left, Math.min(g.right, g.left + room));
    },
    [reveal],
  );

  // A tap on the tab already open brings all of it into view (a phone's tab half under the fade).
  const onClick = (e: ReactMouseEvent) => {
    if ((e.target as HTMLElement).closest('[role="tab"][aria-selected="true"]')) revealActive();
  };

  // Left and Right move between tabs and folder chips (skipping tucked-away members), Home and End to the ends.
  // Enter and Space are the buttons' own: open a tab, toggle a folder.
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const from = e.target as HTMLElement;
    if (!from.matches('[data-tab-key]')) return;
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>('[data-tab-key]'),
    ).filter((el) => !el.closest('[inert]'));
    const i = items.indexOf(from);
    const last = items.length - 1;
    const to =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? last
          : e.key === 'ArrowLeft'
            ? Math.max(0, i - 1)
            : Math.min(last, i + 1);
    e.preventDefault();
    items[to]?.focus();
  };

  return (
    <div ref={stripRef} className={TAB_STRIP_CLASS}>
      <div
        role="tablist"
        aria-label="Tabs"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        onClick={onClick}
        className={TAB_LIST_CLASS}
      >
        {runs.map((run) =>
          run.kind === 'loose' ? (
            renderTab(run.tab)
          ) : (
            <TabFolderGroup
              key={`folder:${run.name}`}
              name={run.name}
              tabs={run.tabs}
              activeId={activeId}
              expanded={expanded.has(run.name)}
              readOnly={readOnly}
              onToggle={() => toggleFolder(run.name)}
              renderTab={renderTab}
              onJoin={(src, first) => onReorder(src, first)}
              onRename={renameFolder}
              renderRenameField={renderRenameField}
              hiddenPresence={folderPresence}
              onOpened={revealGroup}
            />
          ),
        )}
      </div>
      {readOnly || !onAdd ? null : (
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add tab"
          data-tour-id="add-tab"
          className={TAB_ADD_CLASS}
        >
          +
        </button>
      )}
    </div>
  );
}
