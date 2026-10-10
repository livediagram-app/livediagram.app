// The edits to an Illustrate tab's pages (docs/specs/007-editor/illustrate-pages.md): turn,
// resize, rename and paint a page; add, duplicate, move and delete one. On an article page
// (docs/specs/007-editor/article-pages.md) each acts on the whole document: its pages share their
// size, orientation and background, and move, copy and go as one. Each is one tab edit (one undo
// step, synced to everyone) that moves the content of every page it shifts along with it
// (withIllustratePages), re-reading the tab at commit time so two quick edits compose.
import {
  elementIdsOnPage,
  illustratePagesOf,
  layOutIllustratePages,
  MAX_ILLUSTRATE_PAGES,
  nextArticleFlowId,
  nextIllustratePageId,
  pageHasOrientation,
  pageKindOf,
  pageSizesFor,
  pageUnits,
  withPageKindChosen,
  PAGE_NAME_MAX,
  withIllustratePages,
  withPageSplit,
  withPageInkFor,
  pageAdded,
  pageBackgroundSet,
  pageDuplicated,
  pageLaidOut,
  pageLockRefuses,
  pageLockSet,
  pageMovedTo,
  pageRemoved,
  pageRenamed,
  pageResized,
  pagesSharing,
  pageTurned,
  type IllustratePage,
  type PageEdit,
  type PageBackground,
  type PageKind,
  type PageOrientation,
  type PageSizeId,
  type Tab,
} from '@livediagram/document';
import type { PageLayoutId } from '@livediagram/templates';
import { buildPageLayout } from '@livediagram/templates';
import { sameFill, withBackgroundPatch } from '@/lib/illustrate-page-paint';
import { debugLog } from '@/lib/debug-log';
import { clearLocalPreview, localPreview, setLocalPreview } from '@/lib/drag-preview';
import { track } from '@/lib/telemetry';
import { articleHandleOf } from '@/lib/article/article-editor-store';

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
  // The first page's kind chosen while it is the only page and empty (its own choice cards).
  choosePageKind: (pageId: string, kind: PageKind) => void;
  duplicatePage?: (pageId: string) => void;
  // Whether a page's copy fits under the page limit (an article's copy is all its pages).
  canDuplicate: (pageId: string) => boolean;
  // Absent while there is only one unit (one page, or one document).
  removePage?: (pageId: string) => void;
  // A Fit to Content page split into one page per cluster of its content, nothing scaled
  // (docs/specs/007-editor/illustrate-pages.md "Split Into Pages").
  splitPage: (pageId: string) => void;
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
  // Locking a page (docs/specs/007-editor/illustrate-pages.md "Locking a page"): it, and what is
  // on it, stay as they are. Every edit above refuses a locked page.
  isLocked: (pageId: string) => boolean;
  setLocked: (pageId: string, locked: boolean) => void;
  // Blank chosen on the page's Start From a Layout card: the card is not offered there again.
  startBlank: (pageId: string) => void;
};

type TabChange = (tab: Tab) => Tab | null;

// A pure page edit's answer as a commit: its tab, or no change when refused (the checks above
// already said why) or when nothing changed.
const edited = (before: Tab, out: PageEdit<Tab>): Tab | null =>
  'tab' in out && out.tab !== before ? out.tab : null;

// Telemetry for a kind chosen on the first page, and for a page of a kind added.
const KIND_CHOSEN_EVENT: Record<PageKind, string> = {
  infographic: 'PageKindInfographic',
  article: 'PageKindArticle',
  slide: 'PageKindSlide',
  logo: 'PageKindLogo',
};
const KIND_ADDED_EVENT: Record<PageKind, string> = {
  infographic: 'PageAdded',
  article: 'ArticleAdded',
  slide: 'SlidePageAdded',
  logo: 'LogoPageAdded',
};

export function illustratePageEdits({
  tabId,
  current,
  elements,
  commitTabs,
  onGoTo,
  onArticleCreated,
  onLayoutPlaced,
  mayEdit = () => true,
  toastInfo = () => {},
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
  // The page the view should glide to: a new page (added or duplicated), or the page before a
  // deleted one.
  onGoTo: (pageId: string) => void;
  // A new document by its flow id, so its writing can take the caret.
  onArticleCreated?: (flow: string) => void;
  // What a page action says it did (Split Into Pages).
  toastInfo?: (message: string) => void;
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
  const isLocked = (pageId: string) => page(pageId)?.locked === true;
  // A locked page takes no edit of its own (its name, size, turn, paint, layout, kind or delete).
  // An article's pages change together (a turn, a size, its paint, a delete): any of them locked
  // refuses those for all. A page's own edits (its name) reach only the page itself, so another
  // page's lock never holds them (`shared: false`).
  const refusedLocked = (pageId: string, edit: string, shared = true) => {
    if (!pageLockRefuses(current, pageId, shared)) return false;
    debugLog('[illustrate-page] refused: page locked', { tabId, pageId, edit });
    return true;
  };
  const setLocked = (pageId: string, locked: boolean) => {
    if (!page(pageId) || isLocked(pageId) === locked) return;
    // Tracked before it changes, so an unlock still reaches the wire.
    track('Tab', 'Changed', locked ? 'PageLocked' : 'PageUnlocked');
    commitTab((t) => edited(t, pageLockSet(t, pageId, locked)));
    debugLog('[illustrate-page] lock set', { tabId, pageId, locked });
  };
  const startBlank = (pageId: string) => {
    const target = page(pageId);
    if (!target || target.startedBlank === true || refusedLocked(pageId, 'start blank', false))
      return;
    patchPage(pageId, (p) => ({ ...p, startedBlank: true }));
    debugLog('[illustrate-page] started blank', { tabId, pageId });
  };
  // A turn or a new size re-fits an infographic page's content into the page as it now is: what
  // was on it before stays on it, scaled down as one where it no longer fits
  // (withContentFittedToPage). A document's pages all change together; its writing reflows and
  // its zones follow, so nothing is fitted.
  // An article's pages re-flowing is this person's layout to settle (its zones' elements).
  const claimArticleLayout = (pageId: string) => {
    const flow = page(pageId)?.flow;
    if (flow) articleHandleOf(flow)?.claimLayout();
  };

  // A page in a slide size (every slide page) has no turn: it is landscape only.
  const setOrientation = (pageId: string, next: PageOrientation) => {
    if (refusedLocked(pageId, 'orientation')) return;
    const target = page(pageId);
    if (!target || target.orientation === next) return;
    if (!pageHasOrientation(target)) {
      debugLog('[illustrate-page] turn refused: landscape only', { tabId, pageId });
      return;
    }
    track('Tab', 'Changed', next === 'landscape' ? 'PageLandscape' : 'PagePortrait');
    claimArticleLayout(pageId);
    commitTab((t) => edited(t, pageTurned(t, pageId, next)));
    // The view frames the page itself, so a turned page is framed again in its new shape.
    onGoTo(pageId);
    debugLog('[illustrate-page] orientation set', { tabId, pageId, orientation: next });
  };
  // A page takes only the sizes its kind offers (pageSizesFor): a slide page a slide size, an
  // article a paper or screen size, a logo page keeps its artboard, the artboard being the logo
  // kind's alone.
  const setSize = (pageId: string, size: PageSizeId) => {
    if (refusedLocked(pageId, 'size')) return;
    const target = page(pageId);
    if (!target || (target.size ?? 'a4') === size) return;
    if (size !== 'fit' && !pageSizesFor(pageKindOf(target)).includes(size)) {
      debugLog('[illustrate-page] size refused: not offered for the kind', {
        tabId,
        pageId,
        size,
        kind: pageKindOf(target),
      });
      return;
    }
    // Fit to Content's sides come from content: no page chooses it (docs/specs/007-editor/
    // illustrate-pages.md "Sizes").
    if (size === 'fit') {
      debugLog('[illustrate-page] size refused: fit to content', { tabId, pageId });
      return;
    }
    track('Tab', 'Changed', 'PageSize');
    claimArticleLayout(pageId);
    commitTab((t) => edited(t, pageResized(t, pageId, size)));
    onGoTo(pageId);
    debugLog('[illustrate-page] size set', { tabId, pageId, size });
  };
  const rename = (pageId: string, raw: string) => {
    if (refusedLocked(pageId, 'name', false)) return;
    const name = raw.trim().slice(0, PAGE_NAME_MAX);
    if ((page(pageId)?.name ?? '') === name) return;
    track('Tab', 'Changed', 'PageRenamed');
    commitTab((t) => edited(t, pageRenamed(t, pageId, name)));
    debugLog('[illustrate-page] renamed', { tabId, pageId, named: name !== '' });
  };
  // A new fill also re-inks the page's own-coloured text, lines and icons so they still read on it
  // (withPageInkFor), in the same edit.
  const setBackground = (pageId: string, patch: Partial<PageBackground>) => {
    if (refusedLocked(pageId, 'background')) return;
    const target = page(pageId);
    if (!target) return;
    // A logo page takes no pattern (docs/specs/007-editor/logo-pages.md "A logo page").
    if (target.kind === 'logo' && 'pattern' in patch) {
      debugLog('[illustrate-page] pattern refused: a logo page', { tabId, pageId });
      return;
    }
    // Re-picking what the page already wears is no edit (no undo step, no event).
    const was = target.background;
    const next = withBackgroundPatch(target, patch);
    if (sameFill(was?.fill, next?.fill) && was?.pattern === next?.pattern) return;
    track('Tab', 'Changed', 'fill' in patch ? 'PageBackground' : 'PagePattern');
    commitTab((t) => edited(t, pageBackgroundSet(t, pageId, patch)));
    debugLog('[illustrate-page] background set', { tabId, pageId, keys: Object.keys(patch) });
  };
  const units = pageUnits(current);
  const unitIndexOf = (pageId: string) => units.findIndex((u) => u.pageIds.includes(pageId));
  const movePageTo = (pageId: string, unitIndex: number) => {
    const from = unitIndexOf(pageId);
    if (from < 0 || from === unitIndex) return;
    track('Tab', 'Changed', 'PageMoved');
    commitTab((t) => edited(t, pageMovedTo(t, pageId, unitIndex)));
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
  // (A4, US Letter, A3), else A4 portrait; a new slide the last slide's size (else 16:9),
  // landscape; a new logo page the 1024 artboard. All on the plain paper.
  const choosePageKind = (pageId: string, kind: PageKind) => {
    if (refusedLocked(pageId, 'kind')) return;
    track('Tab', 'Changed', KIND_CHOSEN_EVENT[kind]);
    const flow = nextArticleFlowId(new Set());
    commitTab((t) => withPageKindChosen(t, pageId, kind, flow));
    if (kind === 'article') onArticleCreated?.(flow);
    debugLog('[illustrate-page] first page kind chosen', { tabId, pageId, kind });
  };
  const addPage = (kind: PageKind) => {
    track('Tab', 'Changed', KIND_ADDED_EVENT[kind]);
    const id = nextIllustratePageId(current);
    const flow = nextArticleFlowId(new Set(current.flatMap((p) => (p.flow ? [p.flow] : []))));
    commitTab((t) => edited(t, pageAdded(t, kind, id, flow)));
    if (kind === 'article') {
      onGoTo(id);
      onArticleCreated?.(flow);
      debugLog('[illustrate-page] article added', { tabId, flow, count: current.length + 1 });
      return;
    }
    onGoTo(id);
    debugLog('[illustrate-page] page added', { tabId, count: current.length + 1 });
  };
  const duplicatePage = (pageId: string) => {
    const target = page(pageId);
    if (!target) return;
    track('Tab', 'Changed', 'PageDuplicated');
    const flow = nextArticleFlowId(new Set(current.flatMap((p) => (p.flow ? [p.flow] : []))));
    const id = nextIllustratePageId(current);
    let created: string | undefined;
    commitTab((t) => {
      const out = edited(t, pageDuplicated(t, pageId, id, flow));
      if (out) created = target.flow ? out.pages?.find((p) => p.flow === flow)?.id : id;
      return out;
    });
    if (created) onGoTo(created);
    if (target.flow) {
      debugLog('[illustrate-page] article duplicated', { tabId, flow: target.flow });
      return;
    }
    debugLog('[illustrate-page] duplicated', { tabId, pageId });
  };
  // A deleted page takes its content with it; the pages after it close the gap. An article page
  // deletes its whole document, writing and all.
  const removePage = (pageId: string) => {
    if (refusedLocked(pageId, 'delete')) return;
    const target = page(pageId);
    if (!target || units.length <= 1) return;
    track('Tab', 'Changed', 'PageRemoved');
    // The view glides to the page before it (the next, when the first goes), so a delete never
    // leaves an empty stretch of canvas in view (docs/specs/007-editor/illustrate-pages.md
    // "Page actions").
    const at = unitIndexOf(pageId);
    const land = at > 0 ? units[at - 1]!.pageIds.at(-1) : units[at + 1]?.pageIds[0];
    if (land) onGoTo(land);
    commitTab((t) => edited(t, pageRemoved(t, pageId)));
    if (target.flow) {
      debugLog('[illustrate-page] article removed', { tabId, flow: target.flow });
      return;
    }
    debugLog('[illustrate-page] page removed', { tabId, pageId });
  };

  // One page per cluster of the page's content, each cluster at its own size; the view goes to the
  // first. One tab edit.
  const splitPage = (pageId: string) => {
    if (refusedLocked(pageId, 'split')) return;
    // At the page limit a split has no room for a second page.
    if (current.length >= MAX_ILLUSTRATE_PAGES) {
      toastInfo(
        `A tab holds at most ${MAX_ILLUSTRATE_PAGES} pages: delete one to split this page.`,
      );
      debugLog('[illustrate-page] split refused: page limit', { tabId, pageId });
      return;
    }
    // Read inside the commit (it runs at once), as Duplicate reads its copy's id.
    let made = 0;
    let first: string | undefined;
    commitTab((t) => {
      const before = illustratePagesOf(t);
      const out = withPageSplit(t, pageId);
      made = out ? out.pages.length - before.length + 1 : 0;
      first = out?.pages[before.findIndex((p) => p.id === pageId)]?.id;
      return out;
    });
    if (made === 0) {
      toastInfo('This page is one group: nothing to split.');
      debugLog('[illustrate-page] split: one group', { tabId, pageId });
      return;
    }
    track('Tab', 'Changed', 'PagesLaidOut');
    toastInfo(`Split into ${made} pages. Undo puts it back.`);
    if (first) onGoTo(first);
    debugLog('[illustrate-page] page split', { tabId, pageId, pages: made });
  };

  // Laid out in the page's content box (the page less its margins), one tab edit.
  const applyLayout = (pageId: string, layoutId: PageLayoutId) => {
    if (refusedLocked(pageId, 'layout')) return;
    track('Tab', 'Changed', 'PageLayout');
    commitTab((t) => {
      const page = layOutIllustratePages(illustratePagesOf(t)).find((p) => p.id === pageId);
      if (!page) return null;
      return edited(t, pageLaidOut(t, pageId, buildPageLayout(layoutId, page)));
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
    for (const id of pagesSharing(current, preview.pageId))
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
    choosePageKind,
    duplicatePage: room ? duplicatePage : undefined,
    canDuplicate: (pageId: string) => {
      const flow = page(pageId)?.flow;
      const size = flow ? current.filter((p) => p.flow === flow).length : 1;
      return current.length + size <= MAX_ILLUSTRATE_PAGES;
    },
    removePage: units.length > 1 ? removePage : undefined,
    splitPage,
    applyLayout,
    contentCount,
    isLocked,
    setLocked,
    startBlank,
  };
}
