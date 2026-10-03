// The edits to an Infographic tab's pages (docs/specs/007-editor/infographic-pages.md): turn,
// resize, rename and paint a page; add, duplicate, move and delete one. Each is one tab edit (one
// undo step, synced to everyone) that moves the content of every page it shifts along with it
// (withInfographicPages), re-reading the tab at commit time so two quick edits compose.
import {
  elementIdsOnPage,
  infographicPagesOf,
  layOutInfographicPages,
  MAX_INFOGRAPHIC_PAGES,
  nextInfographicPageId,
  PAGE_NAME_MAX,
  withDuplicatedPage,
  withInfographicPages,
  withPageContentReplaced,
  withPageInkFor,
  withContentFittedToPage,
  type InfographicPage,
  type PageBackground,
  type PageOrientation,
  type PageSizeId,
  type Tab,
} from '@livediagram/document';
import type { PageLayoutId } from '@livediagram/templates';
import { buildPageLayout } from '@/lib/page-layout-build';
import { sameFill, withBackgroundPatch } from '@/lib/infographic-page-paint';
import { debugLog } from '@/lib/debug-log';
import { track } from '@/lib/telemetry';

export type InfographicPageEdits = {
  setOrientation: (pageId: string, next: PageOrientation) => void;
  setSize: (pageId: string, size: PageSizeId) => void;
  // Empty clears the name.
  rename: (pageId: string, name: string) => void;
  // Laid over the page's background: `{ fill: undefined }` is back to the paper.
  setBackground: (pageId: string, patch: Partial<PageBackground>) => void;
  // -1 left, 1 right; a no-op at the row's end.
  movePage: (pageId: string, by: -1 | 1) => void;
  // To a place in the row (0 first), its content with it: a page's label dragged.
  movePageTo: (pageId: string, index: number) => void;
  // Absent at the page limit.
  addPage?: () => void;
  duplicatePage?: (pageId: string) => void;
  // Absent while there is only one page.
  removePage?: (pageId: string) => void;
  // Puts a layout onto the page in place of everything on it (the panel asks first when there is
  // anything to replace).
  applyLayout: (pageId: string, layout: PageLayoutId) => void;
  // How many elements are on the page.
  contentCount: (pageId: string) => number;
};

type TabChange = (tab: Tab) => Tab | null;

export function infographicPageEdits({
  tabId,
  current,
  elements,
  commitTabs,
  onCreated,
  onLayoutPlaced,
  mayEdit = () => true,
}: {
  tabId: string;
  current: readonly InfographicPage[];
  // The tab's elements now, to count a page's content.
  elements: Tab['elements'];
  // After a layout lands: the selection is cleared, so none of the replaced elements stays selected.
  onLayoutPlaced: () => void;
  // Whether this person may still edit, asked at commit time: a panel closing because editing went
  // (a view role) must not write its last typed name.
  mayEdit?: () => boolean;
  commitTabs: (map: (ts: Tab[]) => Tab[]) => void;
  // A new page (added or duplicated) by its id, so the view can go to it.
  onCreated: (pageId: string) => void;
}): InfographicPageEdits {
  // A locked tab, or a person no longer editing, takes no page edit.
  const commitTab = (change: TabChange) => {
    if (!mayEdit()) return;
    commitTabs((ts) => ts.map((t) => (t.id === tabId && t.locked !== true ? (change(t) ?? t) : t)));
  };
  // A change to the page list alone (content follows its page).
  const commitPages = (change: (pages: InfographicPage[]) => InfographicPage[] | null) =>
    commitTab((t) => {
      const next = change(infographicPagesOf(t));
      return next ? withInfographicPages(t, next) : null;
    });
  const patchPage = (pageId: string, patch: (p: InfographicPage) => InfographicPage) =>
    commitPages((ps) => ps.map((p) => (p.id === pageId ? patch(p) : p)));
  const page = (pageId: string) => current.find((p) => p.id === pageId);

  // A turn or a new size re-fits the page's content into the page as it now is: what was on it
  // before stays on it, scaled down as one where it no longer fits (withContentFittedToPage).
  const reshapePage = (pageId: string, patch: (p: InfographicPage) => InfographicPage) =>
    commitTab((t) => {
      const before = layOutInfographicPages(infographicPagesOf(t));
      const ids = elementIdsOnPage(t.elements, before, pageId);
      const next = infographicPagesOf(t).map((p) => (p.id === pageId ? patch(p) : p));
      return withContentFittedToPage(withInfographicPages(t, next), ids, pageId);
    });

  const setOrientation = (pageId: string, next: PageOrientation) => {
    if (page(pageId)?.orientation === next) return;
    track('Tab', 'Changed', next === 'landscape' ? 'PageLandscape' : 'PagePortrait');
    reshapePage(pageId, (p) => ({ ...p, orientation: next }));
    debugLog('[infographic-page] orientation set', { tabId, pageId, orientation: next });
  };
  const setSize = (pageId: string, size: PageSizeId) => {
    if ((page(pageId)?.size ?? 'a4') === size) return;
    track('Tab', 'Changed', 'PageSize');
    reshapePage(pageId, (p) => {
      const { size: _drop, ...rest } = p;
      return size === 'a4' ? rest : { ...rest, size };
    });
    debugLog('[infographic-page] size set', { tabId, pageId, size });
  };
  const rename = (pageId: string, raw: string) => {
    const name = raw.trim().slice(0, PAGE_NAME_MAX);
    if ((page(pageId)?.name ?? '') === name) return;
    track('Tab', 'Changed', 'PageRenamed');
    patchPage(pageId, (p) => {
      const { name: _drop, ...rest } = p;
      return name ? { ...rest, name } : rest;
    });
    debugLog('[infographic-page] renamed', { tabId, pageId, named: name !== '' });
  };
  // A new fill also re-inks the page's own-coloured text, lines and icons so they still read on it
  // (withPageInkFor), in the same edit.
  const setBackground = (pageId: string, patch: Partial<PageBackground>) => {
    const target = page(pageId);
    if (!target) return;
    // Re-picking what the page already wears is no edit (no undo step, no event).
    const was = target.background;
    const next = withBackgroundPatch(target, patch);
    if (sameFill(was?.fill, next?.fill) && was?.pattern === next?.pattern) return;
    track('Tab', 'Changed', 'fill' in patch ? 'PageBackground' : 'PagePattern');
    commitTab((t) => {
      const ps = infographicPagesOf(t);
      const target = ps.find((p) => p.id === pageId);
      if (!target) return null;
      const background = withBackgroundPatch(target, patch);
      const next = ps.map((p) => {
        if (p.id !== pageId) return p;
        const { background: _drop, ...rest } = p;
        return background ? { ...rest, background } : rest;
      });
      const repaged = withInfographicPages(t, next);
      return 'fill' in patch ? withPageInkFor(repaged, pageId, background) : repaged;
    });
    debugLog('[infographic-page] background set', { tabId, pageId, keys: Object.keys(patch) });
  };
  const movePageTo = (pageId: string, index: number) => {
    const from = current.findIndex((p) => p.id === pageId);
    if (from < 0 || from === index) return;
    track('Tab', 'Changed', 'PageMoved');
    commitPages((ps) => {
      const i = ps.findIndex((p) => p.id === pageId);
      if (i < 0) return null;
      const next = ps.filter((p) => p.id !== pageId);
      next.splice(Math.max(0, Math.min(index, next.length)), 0, ps[i]!);
      return next;
    });
    debugLog('[infographic-page] moved', { tabId, pageId, from, to: index });
  };
  const movePage = (pageId: string, by: -1 | 1) => {
    const i = current.findIndex((p) => p.id === pageId);
    if (i + by >= 0 && i + by < current.length) movePageTo(pageId, i + by);
  };
  // A new page takes the last page's size and orientation, on the plain paper.
  const addPage = () => {
    track('Tab', 'Changed', 'PageAdded');
    const id = nextInfographicPageId(current);
    commitPages((ps) => {
      if (ps.length >= MAX_INFOGRAPHIC_PAGES || ps.some((p) => p.id === id)) return null;
      const last = ps[ps.length - 1]!;
      return [
        ...ps,
        {
          id,
          orientation: last.orientation,
          ...(last.size ? { size: last.size } : {}),
        },
      ];
    });
    onCreated(id);
    debugLog('[infographic-page] page added', { tabId, count: current.length + 1 });
  };
  const duplicatePage = (pageId: string) => {
    if (!page(pageId)) return;
    track('Tab', 'Changed', 'PageDuplicated');
    const id = nextInfographicPageId(current);
    commitTab((t) => {
      const ps = infographicPagesOf(t);
      if (ps.length >= MAX_INFOGRAPHIC_PAGES || ps.some((p) => p.id === id)) return null;
      return withDuplicatedPage(t, pageId, id);
    });
    onCreated(id);
    debugLog('[infographic-page] duplicated', { tabId, pageId });
  };
  // A deleted page takes its content with it; the pages after it close the gap.
  const removePage = (pageId: string) => {
    if (!page(pageId) || current.length <= 1) return;
    track('Tab', 'Changed', 'PageRemoved');
    commitTab((t) => {
      const ps = infographicPagesOf(t);
      if (ps.length <= 1) return null;
      const emptied = withPageContentReplaced(t, pageId, []);
      return withInfographicPages(
        emptied,
        ps.filter((p) => p.id !== pageId),
      );
    });
    debugLog('[infographic-page] page removed', { tabId, pageId });
  };

  // Laid out in the page's content box (the page less its margins), one tab edit.
  const applyLayout = (pageId: string, layoutId: PageLayoutId) => {
    track('Tab', 'Changed', 'PageLayout');
    commitTab((t) => {
      const page = layOutInfographicPages(infographicPagesOf(t)).find((p) => p.id === pageId);
      if (!page) return null;
      const placed = buildPageLayout(layoutId, page);
      return withPageContentReplaced(t, pageId, placed);
    });
    onLayoutPlaced();
    debugLog('[infographic-page] layout placed', { tabId, pageId, layout: layoutId });
  };
  const laidOut = layOutInfographicPages(current);
  const contentCount = (pageId: string) => elementIdsOnPage(elements, laidOut, pageId).size;

  const room = current.length < MAX_INFOGRAPHIC_PAGES;
  return {
    setOrientation,
    setSize,
    rename,
    setBackground,
    movePage,
    movePageTo,
    addPage: room ? addPage : undefined,
    duplicatePage: room ? duplicatePage : undefined,
    removePage: current.length > 1 ? removePage : undefined,
    applyLayout,
    contentCount,
  };
}
