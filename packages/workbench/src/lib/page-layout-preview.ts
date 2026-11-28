// A page layout hovered and placed through one path (liveworkspace/docs/specs/011-workbench/page-layout-preview.md;
// Work Tracker 1502, 1507): livedocuments' and livedesign's layout galleries both preview a hovered layout by placing
// it with the very function a press commits through, so what a hover shows is what a press lands, in the tab's
// colours, font and design. Each editor makes one with its own placing function and builder (createPageLayoutPreview)
// and draws `useShownLayoutElements` in place of the tab's elements; nothing here knows an element's shape.
//
// A hover places the layout and remembers what it showed; a press on the layout it shows then commits those very
// elements, so not even an id differs. Anything else (the page changed since, another layout, no hover first) is
// placed afresh by the same function.
import { useSyncExternalStore } from 'react';
import { createListeners } from './listeners';
import { debugLog } from './debug-log';
import { createPreviewSettle, type LayoutPreviewAsk } from './layout-preview-settle';

export type PageLayoutPreviewConfig<
  T extends { elements: readonly unknown[] },
  Id extends string,
  B,
> = {
  // The layout builders, loaded on first use (a hover's preview or a press) rather than with the editor.
  load: () => Promise<B>;
  // The tab with `layout` placed on page `pageId` (built for the page, its content carried in, coloured from the
  // tab's theme), or null when the page is gone or locked. Pure: a hover and a press both call it.
  place: (tab: T, pageId: string, layout: Id, build: B) => T | null;
  // A layout pressed (the product's telemetry).
  onPlace: () => void;
};

// The layout a hover is showing: on which tab and page, over which board, and the board it shows.
type Shown<E, Id> = { tabId: string; pageId: string; layout: Id; over: E; elements: E };

export type PageLayoutEditsDeps<T extends { elements: readonly unknown[] }> = {
  tabId: string;
  // The tab and its elements now: what a hover places the layout on, and the board it is shown over.
  tab: T;
  elements: T['elements'];
  commitTab: (change: (t: T) => T | null) => void;
  isLocked: (pageId: string) => boolean;
  // Says why a locked page refuses the edit; true when it does.
  refusedLocked: (pageId: string, edit: string) => boolean;
  // After a layout lands (the selection is cleared).
  onLayoutPlaced: () => void;
};

export function createPageLayoutPreview<
  T extends { elements: readonly unknown[] },
  Id extends string,
  B,
>(config: PageLayoutPreviewConfig<T, Id, B>) {
  type E = T['elements'];
  let shown: Shown<E, Id> | null = null;
  const listeners = createListeners();

  /** Shows a hovered layout (the canvas draws `elements` in place of the tab's own), or puts the tab back (null). */
  const showLayout = (next: Shown<E, Id> | null): void => {
    if (next === shown) return;
    shown = next;
    listeners.notify();
  };
  const elementsFor = (tabId: string): E | null => (shown?.tabId === tabId ? shown.elements : null);
  /** What the canvas draws for tab `tabId` while a layout is hovered: the tab with it placed; else null. */
  const useShownLayoutElements = (tabId: string): E | null =>
    useSyncExternalStore(
      listeners.subscribe,
      () => elementsFor(tabId),
      () => null,
    );
  /** The elements a press on `layout` lands: those the hover showed, while it showed this layout on this page over
   *  this very board; else null, to be placed afresh. */
  const shownLayoutFor = (tabId: string, pageId: string, layout: Id, over: E): E | null => {
    const s = shown;
    return s && s.tabId === tabId && s.pageId === pageId && s.layout === layout && s.over === over
      ? s.elements
      : null;
  };

  // The builders, loaded once; `loaded` holds them once in, so a press after a hover runs without waiting.
  let builder: Promise<B> | null = null;
  let loaded: B | null = null;
  const layoutBuilder = (): Promise<B> =>
    (builder ??= config.load().then((b) => {
      loaded = b;
      return b;
    }));
  // One settle for every page's gallery: a hover anywhere replaces one still waiting anywhere.
  const settle = createPreviewSettle();
  // The newest preview asked for: a build answered after a newer ask draws nothing.
  let latest = 0;

  /** A tab's layout edits: placing a layout, and previewing a hovered one, through the one path. */
  const pageLayoutEdits = ({
    tabId,
    tab,
    elements,
    commitTab,
    isLocked,
    refusedLocked,
    onLayoutPlaced,
  }: PageLayoutEditsDeps<T>) => {
    // A press on the layout a hover shows commits the very elements shown, at once: nothing in between (an await, the
    // popover closing and putting the preview back) can swap them for a fresh build.
    const place = (pageId: string, layout: Id, build: B) => {
      config.onPlace();
      // What the hover showed, read now, before anything can put the preview back.
      const seen = shownLayoutFor(tabId, pageId, layout, elements);
      commitTab((t) =>
        seen && t.elements === elements
          ? { ...t, elements: seen }
          : config.place(t, pageId, layout, build),
      );
      showLayout(null);
      onLayoutPlaced();
      debugLog('[page] layout placed', { tabId, pageId, layout, shown: !!seen });
    };
    // One tab edit, at once when the builders are in (always after a hover); else once they load.
    const applyLayout = async (pageId: string, layout: Id): Promise<void> => {
      settle.cancel();
      latest++;
      if (refusedLocked(pageId, 'layout')) return;
      place(pageId, layout, loaded ?? (await layoutBuilder()));
    };
    // A layout tile hovered or focused: the page drawn with it placed, by the canvas itself, writing nothing; null
    // puts the page back. Drawn once the pointer settles (layout-preview-settle.ts), so a sweep draws only its last.
    const previewLayout = (pageId: string, layout: Id | null, how: LayoutPreviewAsk = 'focus') => {
      const ask = ++latest;
      if (!layout || isLocked(pageId)) {
        // Put back on the next frame, so focus moving from tile to tile (a blur, then a focus) never flashes the page.
        settle.ask('focus', () => {
          if (ask === latest && elementsFor(tabId)) showLayout(null);
        });
        return;
      }
      settle.ask(how, () => {
        void layoutBuilder().then((build) => {
          if (ask !== latest) return;
          const placed = config.place(tab, pageId, layout, build);
          if (!placed) return;
          showLayout({ tabId, pageId, layout, over: elements, elements: placed.elements });
        });
      });
    };
    return { applyLayout, previewLayout };
  };

  return {
    showLayout,
    useShownLayoutElements,
    /** The hovered layout's board for a tab, read outside React (tests); null when none shows. */
    shownLayoutElements: elementsFor,
    shownLayoutFor,
    pageLayoutEdits,
  };
}
