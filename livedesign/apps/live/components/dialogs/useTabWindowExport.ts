'use client';

// Tab windows in an export (docs/specs/009-elements/tab-window.md "Exports"): each window's tab fetched (its content
// arrives only when opened or fetched) with its photos, then drawn once and fitted inside the window, as on screen.
// A window inside a shown tab draws as its frame named for its tab, so nothing recurses.
import { useEffect, useMemo, useState } from 'react';
import { useLatest } from '@/hooks/ui/useLatest';
import {
  tabHasDrawing,
  tabWindowMayShow,
  tabWindowNames,
  type ResolveTabWindow,
  type Tab,
  type TabWindowArt,
} from '@livedesign/document';
import { planImageOf } from '@livedesign/plan-art';
import { tabAsSeen } from '@/lib/export-as-seen';
import { loadTabImages, renderTabToSvg } from '@/lib/export-tab';
import { getTheme } from '@/lib/themes';
import { renderTabDrawingSvg, tabDrawingFontIdsOf } from '@/lib/tab-drawing';
import { tabImageKey, type ExportImageMap } from '@/lib/export-tab-images';
import { svgFrameOf } from '@/lib/svg-frame';

type ImageContext = { ownerId: string; documentId: string; shareCode: string | null };

/** The tabs this tab's windows show, by id, in the order they are met. */
export function tabWindowTargets(tab: Pick<Tab, 'id' | 'elements'>): string[] {
  const ids: string[] = [];
  for (const el of tab.elements) {
    if (el.type !== 'shape' || el.shape !== 'tab-window' || !el.windowTabId) continue;
    if (el.windowTabId !== tab.id && !ids.includes(el.windowTabId)) ids.push(el.windowTabId);
  }
  return ids;
}

/** Each shown tab drawn for a window: its name, and its drawing when it has anything on it. Only tabs a window may
 *  show are drawn; inside them a window is its named frame. A Pages tab draws as its pages and a Form tab as its form
 *  (renderTabDrawingSvg); a Board or Dashboard tab laid out (planImageOf), without its Sheets' cells or figures. */
export function tabWindowArts(
  ownTabId: string,
  targets: readonly string[],
  tabs: readonly Tab[],
  images: ReadonlyMap<string, ExportImageMap>,
  items?: Pick<Parameters<typeof renderTabToSvg>[1] & object, 'items' | 'itemTypes'>,
): Map<string, TabWindowArt> {
  const names = tabWindowNames(tabs);
  const arts = new Map<string, TabWindowArt>();
  const now = new Date();
  for (const id of targets) {
    const t = tabs.find((x) => x.id === id);
    if (!t || !tabWindowMayShow(t, ownTabId)) continue;
    const name = t.name || 'Untitled tab';
    if (!tabHasDrawing(t)) {
      arts.set(id, { name });
      continue;
    }
    const seen = tabAsSeen(t);
    const plan = planImageOf(seen, {
      tabs,
      now,
      themeOf: getTheme,
      renderDiagram: (shown) =>
        renderTabToSvg(tabAsSeen(shown), { pattern: false, ...(items ?? {}) }),
    });
    const markup = renderTabDrawingSvg(plan?.tab ?? seen, {
      pattern: false,
      images: images.get(id),
      resolveTabWindow: names,
      ...(plan ? { resolvePlanArt: (el) => plan.art.get(el.id) } : {}),
      ...(items ?? {}),
    });
    const frame = svgFrameOf(markup);
    arts.set(id, {
      name,
      drawing: {
        markup,
        width: frame.width,
        height: frame.height,
        background: seen.backgroundColor ?? '#ffffff',
      },
    });
  }
  return arts;
}

/** What the export needs for this tab's windows: the resolver, the shown tabs' typefaces, and whether everything has
 *  arrived. Nothing is fetched until `active` (an image format picked). */
export function useTabWindowExport({
  tab,
  tabs,
  loadTabs,
  imageContext,
  active,
  items,
}: {
  tab: Pick<Tab, 'id' | 'elements'>;
  tabs: readonly Tab[];
  // The editor's fetch of the named tabs; it resolves once each has loaded or failed, a fetch already under way
  // elsewhere included, so what is drawn is never a tab's empty placeholder.
  loadTabs?: (only: readonly string[]) => Promise<string[]>;
  imageContext?: ImageContext;
  active: boolean;
  items?: Pick<Parameters<typeof renderTabToSvg>[1] & object, 'items' | 'itemTypes'>;
}): { resolveTabWindow?: ResolveTabWindow; tabWindowFontIds?: string[]; ready: boolean } {
  const targets = useMemo(() => tabWindowTargets(tab), [tab]);
  const ownId = useLatest(tab.id);
  const key = targets.join(',');
  const [fetched, setFetched] = useState<string | null>(null);
  // The shown tabs' photos, and which fetch they are for.
  const [images, setImages] = useState<{ key: string; map: ReadonlyMap<string, ExportImageMap> }>(
    () => ({ key: '', map: new Map() }),
  );
  // Fetch the shown tabs' content once an image format is picked; done once each has arrived or failed. Only the
  // tabs a window may show are fetched (never its own tab), so an export never waits on,
  // nor downloads, content it will not draw.
  const known = useLatest(tabs);
  useEffect(() => {
    if (!active || key === '') return;
    let live = true;
    const ids = key.split(',').filter((id) => {
      const t = known.current.find((x) => x.id === id);
      return !!t && tabWindowMayShow(t, ownId.current);
    });
    void (loadTabs && ids.length ? loadTabs(ids) : Promise.resolve([] as string[])).then(() => {
      if (live) setFetched(key);
    });
    return () => {
      live = false;
    };
  }, [active, key, loadTabs, known, ownId]);
  // Then their photos, each tab's once.
  const shown = useMemo(
    () => (fetched === key ? targets.flatMap((id) => tabs.filter((t) => t.id === id)) : []),
    [fetched, key, targets, tabs],
  );
  // Keyed on the shown tabs' photo ids, not on the tabs: an edit to any tab (a collaborator's, say)
  // makes new tab objects, and refetching every photo on each would keep the export from settling.
  const photoKey = `${key}|${shown.map((t) => `${t.id}:${tabImageKey(t)}`).join(';')}`;
  const shownNow = useLatest(shown);
  useEffect(() => {
    const now = shownNow.current;
    if (!imageContext || now.length === 0) return;
    let live = true;
    void Promise.all(
      now.map(async (t) => [t.id, await loadTabImages(t, imageContext)] as const),
    ).then((pairs) => live && setImages({ key: photoKey, map: new Map(pairs) }));
    return () => {
      live = false;
    };
  }, [photoKey, imageContext, shownNow]);
  // Drawn once everything has arrived: the content, and the photos where there is a way to fetch
  // them. A window whose tab is gone (deleted) shows no tab, so it waits for no photos.
  const settled =
    fetched === key && (!imageContext || shown.length === 0 || images.key === photoKey);
  return useMemo(() => {
    if (targets.length === 0) return { ready: true };
    if (!settled) return { ready: false };
    const arts = tabWindowArts(tab.id, targets, tabs, images.map, items);
    return {
      resolveTabWindow: (el) => (el.windowTabId ? arts.get(el.windowTabId) : undefined),
      tabWindowFontIds: shown.flatMap(tabDrawingFontIdsOf),
      ready: true,
    };
  }, [settled, tab.id, targets, tabs, images, items, shown]);
}
