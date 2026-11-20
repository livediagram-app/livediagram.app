'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { Glyph, Tooltip } from '@liveworkspace/ui';
import {
  edgeMask,
  pageScrollLeft,
  scrollEdges,
  scrollLeftToReveal,
  TAB_REVEAL_PAD,
} from './tab-strip-scroll';
import {
  TAB_ADD_CLASS,
  TAB_LIST_CLASS,
  TAB_SCROLL_BUTTON_CLASS,
  TAB_SLIDER_CLASS,
  TAB_STRIP_CLASS,
  TAB_STRIP_FRAME_CLASS,
} from './tab-shape';
import { useTabSlider } from './useTabSlider';
import { useStripRoving } from './useStripRoving';
import { TabFolderGroup, type TabFolderGroupProps } from './TabFolderGroup';
import { foldersOpenOnLoad } from './tab-folder-start';

// The footer's tab strip, shared by every editor (docs/specs/007-editor/editor-app.md "Tab bar", "How a tab looks";
// docs/specs/006-document/tab-folders.md "Tab bar rendering"): the scroller, the `toolbar` of tabs and folders, Add
// tab, which folders are open this visit, the arrow keys, and keeping the open tab in view. A toolbar, not a tablist:
// a tab holds its avatars and menu button beside its name, and a tablist may own nothing but tabs. Behaviour finds
// tabs by their data attributes (`data-tab`, `data-tab-key`, `data-active`), never by ARIA.

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

// A tab dragged over a scroll button pages the strip once per this long, so a held drag walks the row at a pace the
// eye can follow (dragover fires every ~50ms).
const DRAG_PAGE_MS = 450;

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
  const listRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // Which folders are open: this visit's own, never stored or broadcast. On load a small bar on desktop starts with
  // every folder open, any other with every folder shut (foldersOpenOnLoad), decided once, the first time the strip has
  // tabs. The one holding the open tab shows open on top of this (TabFolderGroup), without being added here, so leaving
  // it restores this.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => foldersOpenOnLoad(runs));
  const [loaded, setLoaded] = useState(() => runs.length > 0);
  if (!loaded && runs.length > 0) {
    // The tabs arrived after the strip mounted: decide now, while rendering, so no folder animates open.
    setLoaded(true);
    setExpanded(foldersOpenOnLoad(runs));
  }
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
    if (to !== strip.scrollLeft)
      strip.scrollTo({ left: to, behavior: still() ? 'auto' : 'smooth' });
  }, []);

  // The open tab is always in view: a tab added to a full strip, or picked from the Tabs list, used to open past the
  // strip's edge. Measures the whole tab, its menu button and avatars included; the last tab brings Add tab with it.
  // Runs when the open tab or the number of tabs changes, and on a tap on the open tab, never on a timer.
  const tabIds = runs.flatMap((r) => (r.kind === 'loose' ? [r.tab.id] : r.tabs.map((t) => t.id)));
  const tabCount = tabIds.length;
  const lastTabId = tabIds.at(-1);
  // The strip's order, for the sliding card: a reorder keeps every size, so only this tells it (useTabSlider).
  const order = tabIds.join('|');
  const revealActive = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const measure = () => {
      const tab = strip.querySelector<HTMLElement>('[data-tab][data-active]');
      if (!tab) return;
      const t = tab.getBoundingClientRect();
      const add = activeId === lastTabId ? strip.querySelector('[data-tour-id="add-tab"]') : null;
      reveal(t.left, add ? add.getBoundingClientRect().right : t.right);
    };
    measure();
    // The open tab's slots (its menu button, avatars) and a folder's tabs ease their widths (CollapseWidth), so this
    // first measure is short of where the tab and Add tab land. Once those widths finish, measure once more.
    const easing = (strip.getAnimations?.({ subtree: true }) ?? []).filter((run) => {
      const target = (run.effect as KeyframeEffect | null)?.target;
      return target instanceof HTMLElement && target.matches('[data-collapse-width]');
    });
    if (easing.length > 0)
      void Promise.all(easing.map((run) => run.finished)).then(measure, () => {});
  }, [activeId, lastTabId, reveal]);
  useEffect(revealActive, [revealActive, tabCount]);

  // A strip that narrows (a panel closing hands a footer control back its room, the window shrinking) can leave the
  // open tab past its edge with nothing else changed, so narrowing brings it back. Widening never hides it, and
  // leaves where someone scrolled alone. The open tab growing does the same: renamed to a longer name, it ran past
  // the strip's edge under the footer's Search.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || typeof ResizeObserver === 'undefined') return;
    const tab = strip.querySelector<HTMLElement>('[data-tab][data-active]');
    let width = strip.clientWidth;
    let tabWidth = tab?.offsetWidth ?? 0;
    const observer = new ResizeObserver(() => {
      const next = strip.clientWidth;
      const nextTab = tab?.offsetWidth ?? 0;
      const moved = next < width || nextTab > tabWidth;
      width = next;
      tabWidth = nextTab;
      if (moved) revealActive();
    });
    observer.observe(strip);
    if (tab) observer.observe(tab);
    return () => observer.disconnect();
  }, [revealActive]);

  // Which edges have tabs beyond them: a scroll button shows over each (scrollEdges). Read on scroll (once a frame at
  // most) and whenever the strip or its row changes size (a tab added, removed, renamed, a folder opened), never on a
  // timer; it re-renders only when an edge changes.
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const strip = stripRef.current;
    const list = listRef.current;
    if (!strip) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      // Sideways only: focusing a control whose 44px tap area reaches past the row (Add tab, after a click) scrolled
      // the strip down, lifting every tab 8px off the bar's foot until the page reloaded.
      if (strip.scrollTop !== 0) strip.scrollTop = 0;
      const next = scrollEdges(strip);
      setEdges((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
    };
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    strip.addEventListener('scroll', soon, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(soon);
    observer?.observe(strip);
    if (list) observer?.observe(list);
    return () => {
      strip.removeEventListener('scroll', soon);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // A scroll button's click: about a strip width on, stopping on a tab's edge (pageScrollLeft).
  const page = useCallback((direction: 'left' | 'right') => {
    const strip = stripRef.current;
    if (!strip) return;
    const s = strip.getBoundingClientRect();
    const items = [...strip.querySelectorAll<HTMLElement>('[data-tab], [data-folder-chip]')]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.right > r.left);
    const to = pageScrollLeft(
      direction,
      {
        left: s.left,
        width: s.width,
        scrollLeft: strip.scrollLeft,
        scrollWidth: strip.scrollWidth,
      },
      items,
    );
    if (to !== strip.scrollLeft)
      strip.scrollTo({ left: to, behavior: still() ? 'auto' : 'smooth' });
  }, []);
  const lastDragPage = useRef(0);
  const onDragOverButton = (direction: 'left' | 'right') => () => {
    const now = Date.now();
    if (now - lastDragPage.current < DRAG_PAGE_MS) return;
    lastDragPage.current = now;
    page(direction);
  };
  const scrollButton = (direction: 'left' | 'right') => {
    const label = direction === 'left' ? 'Scroll Tabs Left' : 'Scroll Tabs Right';
    const shown = edges[direction];
    return (
      <Tooltip label={label}>
        <button
          type="button"
          aria-label={label}
          aria-hidden={shown ? undefined : true}
          tabIndex={shown ? undefined : -1}
          data-shown={shown}
          data-tab-scroll={direction}
          onClick={() => page(direction)}
          onDragOver={onDragOverButton(direction)}
          className={`${TAB_SCROLL_BUTTON_CLASS} ${direction === 'left' ? 'left-1' : 'right-1'}`}
        >
          <Glyph size={12} units={12}>
            <path d={direction === 'left' ? 'M7.5 2.5 4 6l3.5 3.5' : 'M4.5 2.5 8 6 4.5 9.5'} />
          </Glyph>
        </button>
      </Tooltip>
    );
  };

  // The open tab's card slides to each tab you open (useTabSlider); a reorder moves it at once.
  useTabSlider(listRef, sliderRef, activeId, order);

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

  // A tap on the name of the tab already open brings all of it into view (a phone's tab half under the fade).
  const onClick = (e: ReactMouseEvent) => {
    const key = (e.target as HTMLElement).closest('[data-tab-key]');
    if (key?.closest('[data-tab]')?.hasAttribute('data-active')) revealActive();
  };

  // One Tab stop, the arrows through every control (useStripRoving).
  const onKeyDown = useStripRoving(listRef);

  return (
    // A landmark: the footer sits outside the editor's header and main, so without one every tab was content no
    // landmark held (axe region) and a screen reader's landmark list had no way to the tabs.
    <nav aria-label="Tab bar" className={TAB_STRIP_FRAME_CLASS}>
      {scrollButton('left')}
      <div ref={stripRef} className={TAB_STRIP_CLASS} style={{ maskImage: edgeMask(edges) }}>
        <div
          ref={listRef}
          role="toolbar"
          aria-label="Tabs"
          aria-orientation="horizontal"
          onKeyDown={onKeyDown}
          onClick={onClick}
          className={TAB_LIST_CLASS}
        >
          {/* First, so every tab and chip paints over it. */}
          <div ref={sliderRef} aria-hidden data-tab-slider="" className={TAB_SLIDER_CLASS} />
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
                onClosed={revealActive}
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
      {scrollButton('right')}
    </nav>
  );
}
