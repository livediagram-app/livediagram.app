// The edits to a Pages tab's pages (docs/specs/007-editor/pages-mode.md): turn,
// resize, rename and paint a page; add, duplicate, move and delete one. Each is one tab edit (one undo
// step, synced to everyone) that moves the content of every page it shifts along with it
// (withPages), re-reading the tab at commit time so two quick edits compose.
import {
  elementIdsOnPage,
  elementsOnPage,
  pagesOf,
  layOutPages,
  MAX_PAGES,
  nextPageId,
  pageHasOrientation,
  pageKindOf,
  pageSizesFor,
  pageUnits,
  withPageKindChosen,
  PAGE_NAME_MAX,
  withPages,
  withPageSplit,
  withPageInkFor,
  pageAdded,
  pageAddedLike,
  pageBackgroundSet,
  pageDuplicated,
  pageLaidOut,
  themedForTab,
  pageIsDark,
  pageLockRefuses,
  pageLockSet,
  pageMovedTo,
  pageRemoved,
  pageRenamed,
  pageResized,
  pagesSharing,
  pageTurned,
  pageDeviceSet,
  type Page,
  type PageEdit,
  type PageBackground,
  type PageKind,
  type PageOrientation,
  type PageSizeId,
  type Tab,
  type WireframeDeviceId,
  type WireframeDevicePatch,
  type WireframeFrameLook,
} from '@livedesign/document';
import type { PageLayoutId } from '@livedesign/templates';
import { sameFill, withBackgroundPatch } from '@/lib/page-paint';
import { pageInkMemory, rememberPageInk } from '@/lib/page-ink-memory';
import { lastWireframeDevice } from '@/lib/wireframe-device-memory';
import { debugLog } from '@/lib/debug-log';
import { clearLocalPreview, localPreview, setLocalPreview } from '@/lib/drag-preview';
import { track } from '@/lib/telemetry';
import { restoreEmptyCard } from '@/components/canvas/empty-card-dismissed';
import { startClosedKey } from '@/components/start/start-closed-key';
import { backgroundCopyEdits, type BackgroundCopyEdits } from './pages-background-copy-edits';

export type PageEdits = BackgroundCopyEdits & {
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
  // Absent at the page limit. A wireframe page takes the device chosen for it.
  addPage?: (kind: PageKind, device?: WireframeDeviceId) => void;
  // Another page like this one after the last (the + beside the last page): its kind and shape, a
  // wireframe page's device and frame too. Absent at the page limit.
  addPageLike?: (pageId: string) => void;
  // A photo page added after a page (else at the end), of a picture's size, gone to: answers its id
  // (Edit as Photo, docs/specs/031-photo/photo-pages.md "Making a photo page").
  addPhotoPage?: (after: string | null, size?: { width: number; height: number }) => string | null;
  // The first page's kind chosen while it is the only page and empty (its own choice cards).
  choosePageKind: (pageId: string, kind: PageKind, device?: WireframeDeviceId) => void;
  // A wireframe page's orientation, frame look or system bars; its device is fixed once made
  // (docs/specs/007-editor/wireframe-pages.md "Choosing the device").
  setDevice: (pageId: string, patch: WireframeDevicePatch) => void;
  duplicatePage?: (pageId: string) => void;
  // Whether a page's copy fits under the page limit.
  canDuplicate: (pageId: string) => boolean;
  // Deletes a page, or its whole document; the last one empties the tab, which opens Start Making Pages again.
  removePage?: (pageId: string) => void;
  // A Fit to Content page split into one page per cluster of its content, nothing scaled
  // (docs/specs/007-editor/pages-mode.md "Split Into Pages").
  splitPage: (pageId: string) => void;
  // Whether the page's unit can move left / right (not at the row's end).
  canMove: (pageId: string, by: -1 | 1) => boolean;
  // Puts a layout onto the page in place of everything on it (the panel asks first when there is
  // anything to replace).
  // Resolves once the layout is placed (its builders load on the first apply).
  applyLayout: (pageId: string, layout: PageLayoutId) => Promise<void>;
  // How many elements are on the page.
  contentCount: (pageId: string) => number;
  // A fill hovered in the panel: what is on the page drawn re-inked as the press would re-ink it
  // (a preview, writing nothing); null puts it back.
  previewInk: (preview: { pageId: string; patch: Partial<PageBackground> } | null) => void;
  // Locking a page (docs/specs/007-editor/pages-mode.md "Locking a page"): it, and what is
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
  logo: 'PageKindLogo',
  wireframe: 'PageKindWireframe',
  photo: 'PageKindPhoto',
};
const KIND_ADDED_EVENT: Record<PageKind, string> = {
  logo: 'LogoPageAdded',
  wireframe: 'WireframePageAdded',
  photo: 'PhotoPageAdded',
};

// Telemetry for a wireframe page's device and frame look (docs/specs/007-editor/wireframe-pages.md).
const WIREFRAME_DEVICE_EVENT: Record<WireframeDeviceId, string> = {
  iphone: 'WireframeDeviceIphone',
  'iphone-duo': 'WireframeDeviceIphoneDuo',
  android: 'WireframeDeviceAndroid',
  ipad: 'WireframeDeviceIpad',
  'android-tablet': 'WireframeDeviceAndroidTablet',
  laptop: 'WireframeDeviceLaptop',
  desktop: 'WireframeDeviceDesktop',
  browser: 'WireframeDeviceBrowser',
  watch: 'WireframeDeviceWatch',
};
const WIREFRAME_FRAME_EVENT: Record<WireframeFrameLook, string> = {
  theme: 'WireframeFrameTheme',
  dark: 'WireframeFrameDark',
  light: 'WireframeFrameLight',
  outline: 'WireframeFrameOutline',
};

export function pageEdits({
  tabId,
  tab,
  current,
  elements,
  layers,
  commitTabs,
  onGoTo,
  onLayoutPlaced,
  mayEdit = () => true,
  toastInfo = () => {},
}: {
  tabId: string;
  // The tab as it is now: what an edit will do (a duplicate's id, how many pages a split makes, whether Tidy Up moves
  // anything) is read from it before committing, never from inside the commit's updater, which React may run later.
  tab: Tab;
  current: readonly Page[];
  // The tab's elements now, to count a page's content.
  elements: Tab['elements'];
  // The tab's layers now, so a Tidy Up preview leaves a locked layer's elements alone as its
  // commit does.
  layers?: Tab['layers'];
  // After a layout lands: the selection is cleared, so none of the replaced elements stays selected.
  onLayoutPlaced: () => void;
  // Whether this person may still edit, asked at commit time: a panel closing because editing went
  // (a view role) must not write its last typed name.
  mayEdit?: () => boolean;
  commitTabs: (map: (ts: Tab[]) => Tab[]) => void;
  // The page the view should glide to: a new page (added or duplicated), or the page before a
  // deleted one.
  onGoTo: (pageId: string) => void;
  // What a page action says it did (Split Into Pages).
  toastInfo?: (message: string) => void;
}): PageEdits {
  // A locked tab, or a person no longer editing, takes no page edit. A handler that tells or moves the view after
  // its edit asks first, so nothing is said of an edit that never landed.
  const takesEdits = () => mayEdit() && tab.locked !== true;
  const commitTab = (change: TabChange) => {
    if (!mayEdit()) return;
    commitTabs((ts) => ts.map((t) => (t.id === tabId && t.locked !== true ? (change(t) ?? t) : t)));
  };
  // A change to the page list alone (content follows its page).
  const commitPages = (change: (pages: Page[]) => Page[] | null) =>
    commitTab((t) => {
      const next = change(pagesOf(t));
      return next ? withPages(t, next) : null;
    });
  const patchPage = (pageId: string, patch: (p: Page) => Page) =>
    commitPages((ps) => ps.map((p) => (p.id === pageId ? patch(p) : p)));
  const page = (pageId: string) => current.find((p) => p.id === pageId);
  const isLocked = (pageId: string) => page(pageId)?.locked === true;
  // A locked page takes no edit of its own (its name, size, turn, paint, layout, kind or delete).
  const refusedLocked = (pageId: string, edit: string) => {
    if (!pageLockRefuses(current, pageId)) return false;
    debugLog('[page] refused: page locked', { tabId, pageId, edit });
    return true;
  };
  const setLocked = (pageId: string, locked: boolean) => {
    if (!page(pageId) || isLocked(pageId) === locked) return;
    // Tracked before it changes, so an unlock still reaches the wire.
    track('Tab', 'Changed', locked ? 'PageLocked' : 'PageUnlocked');
    commitTab((t) => edited(t, pageLockSet(t, pageId, locked)));
    debugLog('[page] lock set', { tabId, pageId, locked });
  };
  const startBlank = (pageId: string) => {
    const target = page(pageId);
    if (!target || target.startedBlank === true || refusedLocked(pageId, 'start blank')) return;
    patchPage(pageId, (p) => ({ ...p, startedBlank: true }));
    debugLog('[page] started blank', { tabId, pageId });
  };
  // A turn or a new size re-fits a page's content into the page as it now is: what
  // was on it before stays on it, scaled down as one where it no longer fits
  // (withContentFittedToPage).

  // A page without a turn (pageHasOrientation: a logo's artboard, a device's screen) refuses one.
  const setOrientation = (pageId: string, next: PageOrientation) => {
    if (refusedLocked(pageId, 'orientation')) return;
    const target = page(pageId);
    if (!target || target.orientation === next) return;
    if (!pageHasOrientation(target)) {
      debugLog('[page] turn refused: landscape only', { tabId, pageId });
      return;
    }
    track('Tab', 'Changed', next === 'landscape' ? 'PageLandscape' : 'PagePortrait');
    commitTab((t) => edited(t, pageTurned(t, pageId, next)));
    // The view frames the page itself, so a turned page is framed again in its new shape.
    onGoTo(pageId);
    debugLog('[page] orientation set', { tabId, pageId, orientation: next });
  };
  // A page takes only the sizes its kind offers (pageSizesFor): a logo page keeps its artboard, the
  // artboard being the logo kind's alone.
  const setSize = (pageId: string, size: PageSizeId) => {
    if (refusedLocked(pageId, 'size')) return;
    const target = page(pageId);
    if (!target || (target.size ?? 'a4') === size) return;
    if (size !== 'fit' && !pageSizesFor(pageKindOf(target)).includes(size)) {
      debugLog('[page] size refused: not offered for the kind', {
        tabId,
        pageId,
        size,
        kind: pageKindOf(target),
      });
      return;
    }
    // Fit to Content's sides come from content: no page chooses it (docs/specs/007-editor/
    // pages-mode.md "Sizes").
    if (size === 'fit') {
      debugLog('[page] size refused: fit to content', { tabId, pageId });
      return;
    }
    track('Tab', 'Changed', 'PageSize');
    commitTab((t) => edited(t, pageResized(t, pageId, size)));
    onGoTo(pageId);
    debugLog('[page] size set', { tabId, pageId, size });
  };
  const rename = (pageId: string, raw: string) => {
    if (refusedLocked(pageId, 'name')) return;
    const name = raw.trim().slice(0, PAGE_NAME_MAX);
    if ((page(pageId)?.name ?? '') === name) return;
    track('Tab', 'Changed', 'PageRenamed');
    commitTab((t) => edited(t, pageRenamed(t, pageId, name)));
    debugLog('[page] renamed', { tabId, pageId, named: name !== '' });
  };
  // A new fill also re-inks what is on the page so it still reads (docs/specs/007-editor/
  // pages-mode.md "Re-inking"), in the same edit, from the author's own colours where this
  // session's memory recalls them.
  const setBackground = (pageId: string, patch: Partial<PageBackground>) => {
    if (refusedLocked(pageId, 'background')) return;
    const target = page(pageId);
    if (!target) return;
    // A logo page takes no pattern (docs/specs/007-editor/logo-pages.md "A logo page").
    if (target.kind === 'logo' && 'pattern' in patch) {
      debugLog('[page] pattern refused: a logo page', { tabId, pageId });
      return;
    }
    // Re-picking what the page already wears is no edit (no undo step, no event).
    const was = target.background;
    const next = withBackgroundPatch(target, patch);
    if (sameFill(was?.fill, next?.fill) && was?.pattern === next?.pattern) return;
    track('Tab', 'Changed', 'fill' in patch ? 'PageBackground' : 'PagePattern');
    commitTab((t) => {
      const out = pageBackgroundSet(t, pageId, patch, pageInkMemory(tabId));
      if ('tab' in out && out.memory) {
        rememberPageInk(tabId, out.memory);
        const reinked = out.tab.elements.filter((el, i) => el !== t.elements[i]).length;
        debugLog('[page] re-inked', {
          tabId,
          pageId,
          reinked,
          remembered: out.memory.size,
        });
      }
      return edited(t, out);
    });
    debugLog('[page] background set', { tabId, pageId, keys: Object.keys(patch) });
  };
  const units = pageUnits(current);
  const unitIndexOf = (pageId: string) => units.findIndex((u) => u.pageIds.includes(pageId));
  const movePageTo = (pageId: string, unitIndex: number) => {
    const from = unitIndexOf(pageId);
    if (from < 0 || from === unitIndex) return;
    track('Tab', 'Changed', 'PageMoved');
    commitTab((t) => edited(t, pageMovedTo(t, pageId, unitIndex)));
    debugLog('[page] moved', { tabId, pageId, from, to: unitIndex });
  };
  const canMove = (pageId: string, by: -1 | 1) => {
    const i = unitIndexOf(pageId);
    return i >= 0 && i + by >= 0 && i + by < units.length;
  };
  const movePage = (pageId: string, by: -1 | 1) => {
    if (canMove(pageId, by)) movePageTo(pageId, unitIndexOf(pageId) + by);
  };
  // A new logo page is the 1024 artboard; a new wireframe page the last wireframe's device. Both on the plain paper.
  const choosePageKind = (pageId: string, kind: PageKind, device?: WireframeDeviceId) => {
    if (refusedLocked(pageId, 'kind')) return;
    track('Tab', 'Changed', KIND_CHOSEN_EVENT[kind]);
    if (kind === 'wireframe' && device) track('Tab', 'Changed', WIREFRAME_DEVICE_EVENT[device]);
    commitTab((t) => withPageKindChosen(t, pageId, kind, device));
    debugLog('[page] first page kind chosen', { tabId, pageId, kind });
  };
  const addPage = (kind: PageKind, chosen?: WireframeDeviceId) => {
    if (!takesEdits()) return;
    // A first wireframe page added without its own choice (Contents' Add Page) takes the device last
    // chosen in this browser; a later one the last wireframe page's (pageAdded).
    const device =
      chosen ??
      (kind === 'wireframe' && !current.some((p) => p.kind === 'wireframe')
        ? lastWireframeDevice()
        : undefined);
    track('Tab', 'Changed', KIND_ADDED_EVENT[kind]);
    if (kind === 'wireframe' && chosen) track('Tab', 'Changed', WIREFRAME_DEVICE_EVENT[chosen]);
    const id = nextPageId(current);
    commitTab((t) => edited(t, pageAdded(t, kind, id, device)));
    onGoTo(id);
    debugLog('[page] page added', { tabId, count: current.length + 1 });
  };
  const setDevice = (pageId: string, patch: WireframeDevicePatch) => {
    if (refusedLocked(pageId, 'device')) return;
    const target = page(pageId);
    if (!target || target.kind !== 'wireframe') return;
    if (patch.frameLook && patch.frameLook !== (target.frameLook ?? 'theme'))
      track('Tab', 'Changed', WIREFRAME_FRAME_EVENT[patch.frameLook]);
    if (patch.systemBars !== undefined)
      track('UI', 'Toggled', patch.systemBars ? 'WireframeSystemBarsOn' : 'WireframeSystemBarsOff');
    if (patch.orientation && patch.orientation !== target.orientation)
      track('Tab', 'Changed', patch.orientation === 'landscape' ? 'PageLandscape' : 'PagePortrait');
    commitTab((t) => edited(t, pageDeviceSet(t, pageId, patch)));
    // A turned page is framed again in its new shape.
    if (patch.orientation) onGoTo(pageId);
    debugLog('[page] device set', { tabId, pageId, keys: Object.keys(patch) });
  };
  const addPageLike = (pageId: string) => {
    if (!takesEdits()) return;
    const source = page(pageId);
    if (!source) return;
    const kind = pageKindOf(source);
    track('Tab', 'Changed', 'PageAddedLikeLast');
    const id = nextPageId(current);
    commitTab((t) => edited(t, pageAddedLike(t, pageId, id)));
    onGoTo(id);
    debugLog('[page] page added like another', { tabId, from: pageId, kind });
  };
  const addPhotoPage = (after: string | null, size?: { width: number; height: number }) => {
    if (!takesEdits()) return null;
    const id = nextPageId(current);
    const at = after ? unitIndexOf(after) : -1;
    track('Tab', 'Changed', 'PhotoPageAdded');
    commitTab((t) => {
      const added = edited(t, pageAdded(t, 'photo', id, undefined, size));
      if (!added || at < 0) return added;
      // Right after the page it came from.
      return edited(added, pageMovedTo(added, id, at + 1)) ?? added;
    });
    onGoTo(id);
    return id;
  };
  const duplicatePage = (pageId: string) => {
    if (!takesEdits()) return;
    const target = page(pageId);
    if (!target) return;
    track('Tab', 'Changed', 'PageDuplicated');
    const id = nextPageId(current);
    const out = edited(tab, pageDuplicated(tab, pageId, id));
    if (out) commitTab((t) => (t === tab ? out : edited(t, pageDuplicated(t, pageId, id))));
    if (out) onGoTo(id);
    debugLog('[page] duplicated', { tabId, pageId });
  };
  // A deleted page takes its content with it; the pages after it close the gap.
  const removePage = (pageId: string) => {
    if (refusedLocked(pageId, 'delete')) return;
    const target = page(pageId);
    if (!target) return;
    track('Tab', 'Changed', 'PageRemoved');
    // The last page goes with everything on the tab, leaving it empty: no pages, no elements, so Start Making Pages opens again, brought back if it was closed
    // (docs/specs/007-editor/start-diagramming.md "Start Making Pages"). Undo puts it all back.
    if (units.length <= 1) {
      commitTab((t) => ({ ...t, elements: [], pages: [] }));
      restoreEmptyCard(startClosedKey(tabId, 'pages'));
      debugLog('[page] last page removed', { tabId, pageId });
      return;
    }
    // The view glides to the page before it (the next, when the first goes), so a delete never
    // leaves an empty stretch of canvas in view (docs/specs/007-editor/pages-mode.md
    // "Page actions").
    const at = unitIndexOf(pageId);
    const land = at > 0 ? units[at - 1]!.pageIds.at(-1) : units[at + 1]?.pageIds[0];
    if (land) onGoTo(land);
    commitTab((t) => edited(t, pageRemoved(t, pageId)));
    debugLog('[page] page removed', { tabId, pageId });
  };

  // One page per cluster of the page's content, each cluster at its own size; the view goes to the
  // first. One tab edit.
  const splitPage = (pageId: string) => {
    if (!takesEdits() || refusedLocked(pageId, 'split')) return;
    // At the page limit a split has no room for a second page.
    if (current.length >= MAX_PAGES) {
      toastInfo(`A tab holds at most ${MAX_PAGES} pages: delete one to split this page.`);
      debugLog('[page] split refused: page limit', { tabId, pageId });
      return;
    }
    // Read from the tab as it is, as Duplicate reads its copy's id.
    const before = pagesOf(tab);
    const split = withPageSplit(tab, pageId);
    const made = split ? split.pages.length - before.length + 1 : 0;
    const first = split?.pages[before.findIndex((p) => p.id === pageId)]?.id;
    // The split names its new pages afresh each time, so the one read is the one stored (unless the tab moved on).
    if (made > 0) commitTab((t) => (t === tab ? split : withPageSplit(t, pageId)));
    if (made === 0) {
      toastInfo('This page is one group: nothing to split.');
      debugLog('[page] split: one group', { tabId, pageId });
      return;
    }
    track('Tab', 'Changed', 'PagesLaidOut');
    toastInfo(`Split into ${made} pages. Undo puts it back.`);
    if (first) onGoTo(first);
    debugLog('[page] page split', { tabId, pageId, pages: made });
  };

  // Laid out in the page's content box (the page less its margins), the page's own words and
  // pictures carried into it (docs/specs/007-editor/pages-mode.md "Content carries over"),
  // one tab edit. The layout builders (every page layout set) load on the first apply rather than
  // with the editor: the pickers that offer a layout load them already to draw their thumbnails,
  // so by the time one is applied the module is in hand.
  const applyLayout = async (pageId: string, layoutId: PageLayoutId): Promise<void> => {
    if (refusedLocked(pageId, 'layout')) return;
    const { buildPageLayoutOver } = await import('@livedesign/templates/page-layout-build');
    track('Tab', 'Changed', 'PageLayout');
    commitTab((t) => {
      const pages = layOutPages(pagesOf(t));
      const page = pages.find((p) => p.id === pageId);
      if (!page) return null;
      const previous = elementsOnPage(t.elements, pages, pageId);
      return edited(
        t,
        pageLaidOut(
          t,
          pageId,
          themedForTab(buildPageLayoutOver(layoutId, page, previous), t.theme, {
            dark: pageIsDark(page),
          }),
        ),
      );
    });
    onLayoutPlaced();
    debugLog('[page] layout placed', { tabId, pageId, layout: layoutId });
  };
  const laidOut = layOutPages(current);
  const contentCount = (pageId: string) => elementIdsOnPage(elements, laidOut, pageId).size;

  const previewInk = (preview: { pageId: string; patch: Partial<PageBackground> } | null) => {
    const target = preview ? page(preview.pageId) : undefined;
    if (!preview || !target || !('fill' in preview.patch)) {
      if (localPreview()?.tabId === tabId) clearLocalPreview();
      return;
    }
    const background = withBackgroundPatch(target, preview.patch);
    let shown: { elements: Tab['elements']; pages: Page[]; layers?: Tab['layers'] } = {
      elements,
      pages: [...current],
      layers,
    };
    for (const id of pagesSharing(current, preview.pageId))
      shown = withPageInkFor(shown, id, background, pageInkMemory(tabId));
    if (shown.elements === elements) {
      if (localPreview()?.tabId === tabId) clearLocalPreview();
      return;
    }
    setLocalPreview(tabId, shown.elements, elements);
  };

  const room = current.length < MAX_PAGES;
  return {
    // Apply to All and the page format painter (docs/specs/007-editor/pages-mode.md
    // "Copying a background").
    ...backgroundCopyEdits({ tabId, current, commitTab, toastInfo, mayEdit }),
    previewInk,
    setOrientation,
    setSize,
    rename,
    setBackground,
    movePage,
    movePageTo,
    canMove,
    addPage: room ? addPage : undefined,
    addPageLike: room ? addPageLike : undefined,
    addPhotoPage: room ? addPhotoPage : undefined,
    choosePageKind,
    setDevice,
    duplicatePage: room ? duplicatePage : undefined,
    canDuplicate: () => current.length + 1 <= MAX_PAGES,
    removePage,
    splitPage,
    applyLayout,
    contentCount,
    isLocked,
    setLocked,
    startBlank,
  };
}
