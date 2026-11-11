// An infographic page's Tidy Up (docs/specs/007-editor/pages-mode.md "Tidy"): the edit, whether it would change
// the page, and its preview. Split out of page-edits.ts, which spreads these into pageEdits.
import {
  elementIdsOnPage,
  layOutPages,
  pageKindOf,
  pageMargin,
  pagesOf,
  type LaidOutPage,
  type Page,
  type Tab,
} from '@livedocuments/document';
import { tidyPageElements } from '@/lib/page-tidy';
import { lockedElementIds } from '@/lib/locked-element-ids';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { clearLocalPreview, localPreview, setLocalPreview } from '@/lib/drag-preview';
import { track } from '@/lib/telemetry';

// Whether a page would change under a Tidy, by tab and page, with what the answer was for: the
// page's own elements (as objects, so an edit elsewhere keeps it), the layers (a lock) and the page
// list. Bounded: past TIDY_MEMO_MAX entries it starts over.
const TIDY_MEMO = new Map<
  string,
  { on: readonly Tab['elements'][number][]; layers: unknown; pages: string; can: boolean }
>();
const TIDY_MEMO_MAX = 256;

export function pageTidyEdits({
  tabId,
  tab,
  current,
  elements,
  layers,
  laidOut,
  commitTab,
  toastInfo,
  mayEdit,
  refusedLocked,
  isLocked,
}: {
  tabId: string;
  tab: Tab;
  current: readonly Page[];
  elements: Tab['elements'];
  layers?: Tab['layers'];
  laidOut: LaidOutPage[];
  commitTab: (change: (tab: Tab) => Tab | null) => void;
  toastInfo: (message: string) => void;
  mayEdit: () => boolean;
  refusedLocked: (pageId: string, edit: string, shared?: boolean) => boolean;
  isLocked: (pageId: string) => boolean;
}) {
  // The tab with the page's elements tidied, or null when nothing would change. Read from the tab
  // it is given, so the commit tidies the tab as it is at commit time.
  const tidied = (t: Tab, pageId: string): Tab | null => {
    const pages = layOutPages(pagesOf(t));
    const target = pages.find((p) => p.id === pageId);
    // An infographic or slide page; an article flows.
    if (!target || (pageKindOf(target) !== 'infographic' && target.kind !== 'slide')) return null;
    const next = tidyPageElements(t.elements, {
      ids: elementIdsOnPage(t.elements, pages, pageId),
      rect: target.rect,
      margin: pageMargin(target),
      lockedIds: lockedElementIds(t.elements, t.layers),
    });
    return next === t.elements ? null : { ...t, elements: next };
  };
  const tidyPage = (pageId: string) => {
    if (!mayEdit() || refusedLocked(pageId, 'tidy', false)) return;
    const out = tidied(tab, pageId);
    const changed = out !== null;
    if (out) commitTab((t) => (t === tab ? out : tidied(t, pageId)));
    if (localPreview()?.tabId === tabId) clearLocalPreview(changed ? 'landed' : 'cancelled');
    if (!changed) {
      toastInfo('This page is already tidy.');
      debugLog('[page] tidy: already tidy', { tabId, pageId });
      return;
    }
    track('Tab', 'Aligned', 'PageTidyUp');
    debugLog('[page] tidied', { tabId, pageId });
  };
  // Remembered per page while its own elements stay as they are, so a pan or a zoom (which
  // re-renders every title bar) and an edit on another page rerun no tidy (3 to 8 ms a page).
  const canTidy = (pageId: string): boolean => {
    const pages = JSON.stringify(current);
    const ids = elementIdsOnPage(elements, laidOut, pageId);
    const on = elements.filter((el) => ids.has(el.id));
    const key = `${tabId}|${pageId}`;
    const hit = TIDY_MEMO.get(key);
    if (
      hit &&
      hit.layers === layers &&
      hit.pages === pages &&
      hit.on.length === on.length &&
      hit.on.every((el, k) => el === on[k])
    ) {
      return hit.can;
    }
    const can =
      tidied({ id: tabId, elements, layers, pages: [...current] } as Tab, pageId) !== null;
    if (TIDY_MEMO.size >= TIDY_MEMO_MAX) TIDY_MEMO.clear();
    TIDY_MEMO.set(key, { on, layers, pages, can });
    return can;
  };
  const previewTidy = (pageId: string | null) => {
    const shown = pageId
      ? tidied({ id: tabId, elements, layers, pages: [...current] } as Tab, pageId)
      : null;
    if (!shown || isLocked(pageId!)) {
      if (localPreview()?.tabId === tabId) clearLocalPreview();
      return;
    }
    setLocalPreview(tabId, shown.elements, elements);
  };
  return { tidyPage, canTidy, previewTidy };
}
