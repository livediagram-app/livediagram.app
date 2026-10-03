// The edits to an Infographic tab's pages (docs/specs/007-editor/infographic-pages.md): turn,
// resize, rename and paint a page; add, duplicate, move and delete one. Each is one tab edit (one
// undo step, synced to everyone) that moves the content of every page it shifts along with it
// (withInfographicPages), re-reading the tab at commit time so two quick edits compose.
import {
  infographicPagesOf,
  MAX_INFOGRAPHIC_PAGES,
  nextInfographicPageId,
  PAGE_NAME_MAX,
  withDuplicatedPage,
  withInfographicPages,
  withPageContentReplaced,
  type InfographicPage,
  type PageBackground,
  type PageOrientation,
  type PageSizeId,
  type Tab,
} from '@livediagram/document';
import { withBackgroundPatch } from '@/lib/infographic-page-paint';
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
  // Absent at the page limit.
  addPage?: () => void;
  duplicatePage?: (pageId: string) => void;
  // Absent while there is only one page.
  removePage?: (pageId: string) => void;
};

type TabChange = (tab: Tab) => Tab | null;

export function infographicPageEdits({
  tabId,
  current,
  commitTabs,
  onCreated,
}: {
  tabId: string;
  current: readonly InfographicPage[];
  commitTabs: (map: (ts: Tab[]) => Tab[]) => void;
  // A new page (added or duplicated) by its id, so the view can go to it.
  onCreated: (pageId: string) => void;
}): InfographicPageEdits {
  const commitTab = (change: TabChange) =>
    commitTabs((ts) => ts.map((t) => (t.id === tabId ? (change(t) ?? t) : t)));
  // A change to the page list alone (content follows its page).
  const commitPages = (change: (pages: InfographicPage[]) => InfographicPage[] | null) =>
    commitTab((t) => {
      const next = change(infographicPagesOf(t));
      return next ? withInfographicPages(t, next) : null;
    });
  const patchPage = (pageId: string, patch: (p: InfographicPage) => InfographicPage) =>
    commitPages((ps) => ps.map((p) => (p.id === pageId ? patch(p) : p)));
  const page = (pageId: string) => current.find((p) => p.id === pageId);

  const setOrientation = (pageId: string, next: PageOrientation) => {
    if (page(pageId)?.orientation === next) return;
    track('Tab', 'Changed', next === 'landscape' ? 'PageLandscape' : 'PagePortrait');
    patchPage(pageId, (p) => ({ ...p, orientation: next }));
    debugLog('[infographic-page] orientation set', { tabId, pageId, orientation: next });
  };
  const setSize = (pageId: string, size: PageSizeId) => {
    if ((page(pageId)?.size ?? 'a4') === size) return;
    track('Tab', 'Changed', 'PageSize');
    patchPage(pageId, (p) => {
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
  const setBackground = (pageId: string, patch: Partial<PageBackground>) => {
    track('Tab', 'Changed', 'fill' in patch ? 'PageBackground' : 'PagePattern');
    patchPage(pageId, (p) => {
      const { background: _drop, ...rest } = p;
      const background = withBackgroundPatch(p, patch);
      return background ? { ...rest, background } : rest;
    });
    debugLog('[infographic-page] background set', { tabId, pageId, keys: Object.keys(patch) });
  };
  const movePage = (pageId: string, by: -1 | 1) => {
    track('Tab', 'Changed', 'PageMoved');
    commitPages((ps) => {
      const i = ps.findIndex((p) => p.id === pageId);
      const j = i + by;
      if (i < 0 || j < 0 || j >= ps.length) return null;
      const next = [...ps];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
    debugLog('[infographic-page] moved', { tabId, pageId, by });
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
    track('Tab', 'Changed', 'PageDuplicated');
    const id = nextInfographicPageId(current);
    commitTab((t) => {
      const ps = infographicPagesOf(t);
      if (ps.length >= MAX_INFOGRAPHIC_PAGES || ps.some((p) => p.id === id)) return null;
      return withDuplicatedPage(t, pageId, id, () => crypto.randomUUID());
    });
    onCreated(id);
    debugLog('[infographic-page] duplicated', { tabId, pageId });
  };
  // A deleted page takes its content with it; the pages after it close the gap.
  const removePage = (pageId: string) => {
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

  const room = current.length < MAX_INFOGRAPHIC_PAGES;
  return {
    setOrientation,
    setSize,
    rename,
    setBackground,
    movePage,
    addPage: room ? addPage : undefined,
    duplicatePage: room ? duplicatePage : undefined,
    removePage: current.length > 1 ? removePage : undefined,
  };
}
