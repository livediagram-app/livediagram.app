// The edits to an Illustrate tab's pages (docs/specs/007-editor/illustrate-pages.md): turn,
// resize, rename and paint a page; add, duplicate, move and delete one. On a document page
// (docs/specs/007-editor/document-pages.md) each acts on the whole document: its pages share their
// size, orientation and background, and move, copy and go as one. Each is one tab edit (one undo
// step, synced to everyone) that moves the content of every page it shifts along with it
// (withIllustratePages), re-reading the tab at commit time so two quick edits compose.
import {
  elementIdsOnPage,
  illustratePagesOf,
  layOutIllustratePages,
  MAX_ILLUSTRATE_PAGES,
  nextDocFlowId,
  nextIllustratePageId,
  pageUnits,
  withDocumentAdded,
  withDocumentDuplicated,
  withDocumentRemoved,
  withUnitMoved,
  PAGE_NAME_MAX,
  withDuplicatedPage,
  withIllustratePages,
  withPageContentReplaced,
  withPageInkFor,
  withContentFittedToPage,
  type IllustratePage,
  type PageBackground,
  type PageKind,
  type PageOrientation,
  type PageSizeId,
  type Tab,
} from '@livediagram/document';
import type { PageLayoutId } from '@livediagram/templates';
import { buildPageLayout } from '@/lib/page-layout-build';
import { sameFill, withBackgroundPatch } from '@/lib/illustrate-page-paint';
import { debugLog } from '@/lib/debug-log';
import { clearLocalPreview, localPreview, setLocalPreview } from '@/lib/drag-preview';
import { track } from '@/lib/telemetry';

export type IllustratePageEdits = {
  setOrientation: (pageId: string, next: PageOrientation) => void;
  setSize: (pageId: string, size: PageSizeId) => void;
  // Empty clears the name.
  rename: (pageId: string, name: string) => void;
  // Laid over the page's background: `{ fill: undefined }` is back to the paper.
  setBackground: (pageId: string, patch: Partial<PageBackground>) => void;
  // -1 left, 1 right (past one neighbouring page or document); a no-op at the row's end.
  movePage: (pageId: string, by: -1 | 1) => void;
  // A page's unit (the page, or its whole document) to a place among the units (0 first), its
  // content with it: a page's label dragged.
  movePageTo: (pageId: string, unitIndex: number) => void;
  // Absent at the page limit.
  addPage?: (kind: PageKind) => void;
  duplicatePage?: (pageId: string) => void;
  // Absent while there is only one unit (one page, or one document).
  removePage?: (pageId: string) => void;
  // Whether the page's unit can move left / right (not at the row's end).
  canMove: (pageId: string, by: -1 | 1) => boolean;
  // Puts a layout onto the page in place of everything on it (the panel asks first when there is
  // anything to replace).
  applyLayout: (pageId: string, layout: PageLayoutId) => void;
  // How many elements are on the page.
  contentCount: (pageId: string) => number;
  // A fill hovered in the panel: the page's own-coloured text, lines and icons drawn re-inked as
  // the press would re-ink them (a preview, writing nothing); null puts them back.
  previewInk: (preview: { pageId: string; patch: Partial<PageBackground> } | null) => void;
};

type TabChange = (tab: Tab) => Tab | null;

export function illustratePageEdits({
  tabId,
  current,
  elements,
  commitTabs,
  onCreated,
  onDocumentCreated,
  onLayoutPlaced,
  mayEdit = () => true,
}: {
  tabId: string;
  current: readonly IllustratePage[];
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
  // A new document by its flow id, so its writing can take the caret.
  onDocumentCreated?: (flow: string) => void;
}): IllustratePageEdits {
  // A locked tab, or a person no longer editing, takes no page edit.
  const commitTab = (change: TabChange) => {
    if (!mayEdit()) return;
    commitTabs((ts) => ts.map((t) => (t.id === tabId && t.locked !== true ? (change(t) ?? t) : t)));
  };
  // A change to the page list alone (content follows its page).
  const commitPages = (change: (pages: IllustratePage[]) => IllustratePage[] | null) =>
    commitTab((t) => {
      const next = change(illustratePagesOf(t));
      return next ? withIllustratePages(t, next) : null;
    });
  const patchPage = (pageId: string, patch: (p: IllustratePage) => IllustratePage) =>
    commitPages((ps) => ps.map((p) => (p.id === pageId ? patch(p) : p)));
  const page = (pageId: string) => current.find((p) => p.id === pageId);
  // The pages a page-wide change reaches: the page, or every page of its document.
  const sharing = (ps: readonly IllustratePage[], pageId: string): Set<string> => {
    const target = ps.find((p) => p.id === pageId);
    if (!target) return new Set();
    return new Set(
      target.flow ? ps.filter((p) => p.flow === target.flow).map((p) => p.id) : [pageId],
    );
  };

  // A turn or a new size re-fits an infographic page's content into the page as it now is: what
  // was on it before stays on it, scaled down as one where it no longer fits
  // (withContentFittedToPage). A document's pages all change together; its writing reflows and
  // its zones follow, so nothing is fitted.
  const reshapePage = (pageId: string, patch: (p: IllustratePage) => IllustratePage) =>
    commitTab((t) => {
      const ps = illustratePagesOf(t);
      const reach = sharing(ps, pageId);
      const next = ps.map((p) => (reach.has(p.id) ? patch(p) : p));
      if (ps.find((p) => p.id === pageId)?.flow) return withIllustratePages(t, next);
      const before = layOutIllustratePages(ps);
      const ids = elementIdsOnPage(t.elements, before, pageId);
      return withContentFittedToPage(withIllustratePages(t, next), ids, pageId);
    });

  const setOrientation = (pageId: string, next: PageOrientation) => {
    if (page(pageId)?.orientation === next) return;
    track('Tab', 'Changed', next === 'landscape' ? 'PageLandscape' : 'PagePortrait');
    reshapePage(pageId, (p) => ({ ...p, orientation: next }));
    debugLog('[illustrate-page] orientation set', { tabId, pageId, orientation: next });
  };
  const setSize = (pageId: string, size: PageSizeId) => {
    if ((page(pageId)?.size ?? 'a4') === size) return;
    track('Tab', 'Changed', 'PageSize');
    reshapePage(pageId, (p) => {
      const { size: _drop, ...rest } = p;
      return size === 'a4' ? rest : { ...rest, size };
    });
    debugLog('[illustrate-page] size set', { tabId, pageId, size });
  };
  const rename = (pageId: string, raw: string) => {
    const name = raw.trim().slice(0, PAGE_NAME_MAX);
    if ((page(pageId)?.name ?? '') === name) return;
    track('Tab', 'Changed', 'PageRenamed');
    patchPage(pageId, (p) => {
      const { name: _drop, ...rest } = p;
      return name ? { ...rest, name } : rest;
    });
    debugLog('[illustrate-page] renamed', { tabId, pageId, named: name !== '' });
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
      const ps = illustratePagesOf(t);
      const target = ps.find((p) => p.id === pageId);
      if (!target) return null;
      const background = withBackgroundPatch(target, patch);
      const reach = sharing(ps, pageId);
      const next = ps.map((p) => {
        if (!reach.has(p.id)) return p;
        const { background: _drop, ...rest } = p;
        return background ? { ...rest, background } : rest;
      });
      let repaged = withIllustratePages(t, next);
      if ('fill' in patch)
        for (const id of reach) repaged = withPageInkFor(repaged, id, background);
      return repaged;
    });
    debugLog('[illustrate-page] background set', { tabId, pageId, keys: Object.keys(patch) });
  };
  const units = pageUnits(current);
  const unitIndexOf = (pageId: string) => units.findIndex((u) => u.pageIds.includes(pageId));
  const movePageTo = (pageId: string, unitIndex: number) => {
    const from = unitIndexOf(pageId);
    if (from < 0 || from === unitIndex) return;
    track('Tab', 'Changed', 'PageMoved');
    commitTab((t) => withUnitMoved(t, pageId, unitIndex));
    debugLog('[illustrate-page] moved', { tabId, pageId, from, to: unitIndex });
  };
  const canMove = (pageId: string, by: -1 | 1) => {
    const i = unitIndexOf(pageId);
    return i >= 0 && i + by >= 0 && i + by < units.length;
  };
  const movePage = (pageId: string, by: -1 | 1) => {
    if (canMove(pageId, by)) movePageTo(pageId, unitIndexOf(pageId) + by);
  };
  // A new infographic page takes the last infographic page's size and orientation (else A4
  // portrait); a new document the last page's paper size and orientation when it is a paper size
  // (A4, US Letter, A3), else A4 portrait. Both on the plain paper.
  const addPage = (kind: PageKind) => {
    track('Tab', 'Changed', kind === 'document' ? 'DocumentPageAdded' : 'PageAdded');
    const id = nextIllustratePageId(current);
    if (kind === 'document') {
      const flow = nextDocFlowId(new Set(current.flatMap((p) => (p.flow ? [p.flow] : []))));
      const last = current[current.length - 1];
      const paper = last && ['a4', 'letter', 'a3'].includes(last.size ?? 'a4');
      commitTab((t) =>
        withDocumentAdded(
          t,
          {
            id,
            orientation: paper ? last.orientation : 'portrait',
            ...(paper && last.size ? { size: last.size } : {}),
          },
          flow,
        ),
      );
      onCreated(id);
      onDocumentCreated?.(flow);
      debugLog('[illustrate-page] document added', { tabId, flow, count: current.length + 1 });
      return;
    }
    commitPages((ps) => {
      if (ps.length >= MAX_ILLUSTRATE_PAGES || ps.some((p) => p.id === id)) return null;
      const model = [...ps].reverse().find((p) => !p.flow);
      return [
        ...ps,
        {
          id,
          orientation: model?.orientation ?? 'portrait',
          ...(model?.size ? { size: model.size } : {}),
        },
      ];
    });
    onCreated(id);
    debugLog('[illustrate-page] page added', { tabId, count: current.length + 1 });
  };
  const duplicatePage = (pageId: string) => {
    const target = page(pageId);
    if (!target) return;
    track('Tab', 'Changed', 'PageDuplicated');
    if (target.flow) {
      const flow = nextDocFlowId(new Set(current.flatMap((p) => (p.flow ? [p.flow] : []))));
      let created: string | undefined;
      commitTab((t) => {
        const out = withDocumentDuplicated(t, target.flow!, flow);
        created = out?.pages.find((p) => p.flow === flow)?.id;
        return out;
      });
      if (created) onCreated(created);
      debugLog('[illustrate-page] document duplicated', { tabId, flow: target.flow });
      return;
    }
    const id = nextIllustratePageId(current);
    commitTab((t) => {
      const ps = illustratePagesOf(t);
      if (ps.length >= MAX_ILLUSTRATE_PAGES || ps.some((p) => p.id === id)) return null;
      return withDuplicatedPage(t, pageId, id);
    });
    onCreated(id);
    debugLog('[illustrate-page] duplicated', { tabId, pageId });
  };
  // A deleted page takes its content with it; the pages after it close the gap. A document page
  // deletes its whole document, writing and all.
  const removePage = (pageId: string) => {
    const target = page(pageId);
    if (!target || units.length <= 1) return;
    track('Tab', 'Changed', 'PageRemoved');
    if (target.flow) {
      commitTab((t) => withDocumentRemoved(t, target.flow!));
      debugLog('[illustrate-page] document removed', { tabId, flow: target.flow });
      return;
    }
    commitTab((t) => {
      const ps = illustratePagesOf(t);
      if (ps.length <= 1) return null;
      const emptied = withPageContentReplaced(t, pageId, []);
      return withIllustratePages(
        emptied,
        ps.filter((p) => p.id !== pageId),
      );
    });
    debugLog('[illustrate-page] page removed', { tabId, pageId });
  };

  // Laid out in the page's content box (the page less its margins), one tab edit.
  const applyLayout = (pageId: string, layoutId: PageLayoutId) => {
    track('Tab', 'Changed', 'PageLayout');
    commitTab((t) => {
      const page = layOutIllustratePages(illustratePagesOf(t)).find((p) => p.id === pageId);
      if (!page) return null;
      const placed = buildPageLayout(layoutId, page);
      return withPageContentReplaced(t, pageId, placed);
    });
    onLayoutPlaced();
    debugLog('[illustrate-page] layout placed', { tabId, pageId, layout: layoutId });
  };
  const laidOut = layOutIllustratePages(current);
  const contentCount = (pageId: string) => elementIdsOnPage(elements, laidOut, pageId).size;

  const previewInk = (preview: { pageId: string; patch: Partial<PageBackground> } | null) => {
    const target = preview ? page(preview.pageId) : undefined;
    if (!preview || !target || !('fill' in preview.patch)) {
      if (localPreview()?.tabId === tabId) clearLocalPreview();
      return;
    }
    const background = withBackgroundPatch(target, preview.patch);
    let shown: { elements: Tab['elements']; pages: IllustratePage[] } = {
      elements,
      pages: [...current],
    };
    for (const id of sharing(current, preview.pageId))
      shown = withPageInkFor(shown, id, background);
    if (shown.elements === elements) {
      if (localPreview()?.tabId === tabId) clearLocalPreview();
      return;
    }
    setLocalPreview(tabId, shown.elements, elements);
  };

  const room = current.length < MAX_ILLUSTRATE_PAGES;
  return {
    previewInk,
    setOrientation,
    setSize,
    rename,
    setBackground,
    movePage,
    movePageTo,
    canMove,
    addPage: room ? addPage : undefined,
    duplicatePage: room ? duplicatePage : undefined,
    removePage: units.length > 1 ? removePage : undefined,
    applyLayout,
    contentCount,
  };
}
