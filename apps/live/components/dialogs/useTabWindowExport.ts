'use client';

// Tab windows in an export (docs/specs/009-elements/tab-window.md "Exports"): each window's tab fetched (its content
// arrives only when opened or fetched) with its photos, then drawn once and fitted inside the window, as on screen.
// A window inside a shown tab draws as its frame named for its tab, so nothing recurses.
import { useEffect, useMemo, useState } from 'react';
import {
  exportFontIds,
  tabWindowMayShow,
  type ResolveTabWindow,
  type Tab,
  type TabWindowArt,
} from '@livediagram/document';
import { tabAsSeen } from '@/lib/export-as-seen';
import { loadTabImages, renderTabToSvg } from '@/lib/export-tab';
import type { ExportImageMap } from '@/lib/export-tab-images';
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
 *  show are drawn; inside them a window is its named frame. */
export function tabWindowArts(
  ownTabId: string,
  targets: readonly string[],
  tabs: readonly Tab[],
  images: ReadonlyMap<string, ExportImageMap>,
  items?: Pick<Parameters<typeof renderTabToSvg>[1] & object, 'items' | 'itemTypes'>,
): Map<string, TabWindowArt> {
  const names: ResolveTabWindow = (el) => {
    const t = el.windowTabId ? tabs.find((x) => x.id === el.windowTabId) : undefined;
    return t ? { name: t.name || 'Untitled tab' } : undefined;
  };
  const arts = new Map<string, TabWindowArt>();
  for (const id of targets) {
    const t = tabs.find((x) => x.id === id);
    if (!t || !tabWindowMayShow(t, ownTabId)) continue;
    const name = t.name || 'Untitled tab';
    if (t.elements.length === 0) {
      arts.set(id, { name });
      continue;
    }
    const seen = tabAsSeen(t);
    const markup = renderTabToSvg(seen, {
      pattern: false,
      images: images.get(id),
      resolveTabWindow: names,
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
  loadTabs?: (only: readonly string[]) => Promise<string[]>;
  imageContext?: ImageContext;
  active: boolean;
  items?: Pick<Parameters<typeof renderTabToSvg>[1] & object, 'items' | 'itemTypes'>;
}): { resolveTabWindow?: ResolveTabWindow; tabWindowFontIds?: string[]; ready: boolean } {
  const targets = useMemo(() => tabWindowTargets(tab), [tab]);
  const key = targets.join(',');
  const [fetched, setFetched] = useState<string | null>(null);
  // The shown tabs' photos, and which fetch they are for.
  const [images, setImages] = useState<{ key: string; map: ReadonlyMap<string, ExportImageMap> }>(
    () => ({ key: '', map: new Map() }),
  );
  // Fetch the shown tabs' content once an image format is picked.
  useEffect(() => {
    if (!active || key === '') return;
    let live = true;
    void (loadTabs ? loadTabs(key.split(',')) : Promise.resolve([])).then(
      () => live && setFetched(key),
    );
    return () => {
      live = false;
    };
  }, [active, key, loadTabs]);
  // Then their photos, each tab's once.
  const shown = useMemo(
    () => (fetched === key ? targets.flatMap((id) => tabs.filter((t) => t.id === id)) : []),
    [fetched, key, targets, tabs],
  );
  useEffect(() => {
    if (!imageContext || shown.length === 0) return;
    let live = true;
    void Promise.all(
      shown.map(async (t) => [t.id, await loadTabImages(t, imageContext)] as const),
    ).then((pairs) => live && setImages({ key, map: new Map(pairs) }));
    return () => {
      live = false;
    };
  }, [shown, imageContext, key]);
  // Drawn once everything has arrived: the content, and the photos where there is a way to fetch them.
  const settled = fetched === key && (!imageContext || images.key === key);
  return useMemo(() => {
    if (targets.length === 0) return { ready: true };
    if (!settled) return { ready: false };
    const arts = tabWindowArts(tab.id, targets, tabs, images.map, items);
    return {
      resolveTabWindow: (el) => (el.windowTabId ? arts.get(el.windowTabId) : undefined),
      tabWindowFontIds: shown.flatMap((t) =>
        exportFontIds(t.elements, t.font, undefined, t.finish),
      ),
      ready: true,
    };
  }, [settled, tab.id, targets, tabs, images, items, shown]);
}
