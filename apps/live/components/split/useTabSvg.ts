'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { Tab } from '@livediagram/document';
import { tabAsSeen } from '@/lib/export-as-seen';
import { loadTabImages, renderTabToSvg } from '@/lib/export-tab';
import type { ExportImageMap } from '@/lib/export-tab-images';
import { ensureIconCatalogs } from '@/lib/icon-registry';
import { usePlan } from '@/components/plan/PlanContext';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { useEditorContext } from '@/app/document/[id]/EditorContext';

export type TabSvg = {
  markup: string;
  // The drawing's own size in canvas units (the SVG's width / height), for fitting it to a pane.
  width: number;
  height: number;
  // Where the drawing starts in canvas space (the SVG's viewBox corner): canvas point `origin` is
  // drawn at the SVG's top-left.
  origin: { x: number; y: number };
  // The paper behind the drawing, so the pane around it reads as the same canvas.
  background: string;
};

// The image ids a tab draws, joined: the key its bitmaps are fetched on, so an edit that moves a
// shape doesn't refetch every photo.
function imageKey(tab: Tab): string {
  const ids = new Set<string>();
  for (const el of tab.elements) if (el.type === 'image' && el.imageId) ids.add(el.imageId);
  return [...ids].sort().join(',');
}

const SIZE =
  /<svg[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"[^>]*\bviewBox="(-?[\d.]+) (-?[\d.]+)/;

// A tab drawn as the editor would show it (docs/specs/007-editor/split-view.md "The right pane"):
// the export renderer's SVG, in the viewer's appearance, with the document's Plan items and the
// tab's photos. Re-rendered when the tab changes (an edit, a collaborator's op) at a deferred
// priority, so a burst of remote edits never competes with the editor beside it.
export function useTabSvg(tab: Tab | undefined): TabSvg | null {
  const { imageContext } = useEditorContext();
  const plan = usePlan();
  const { appearance } = useAppearance();
  const deferredTab = useDeferredValue(tab);
  const [iconsReady, setIconsReady] = useState(false);
  const [images, setImages] = useState<{ key: string; map: ExportImageMap } | null>(null);

  useEffect(() => {
    let live = true;
    void ensureIconCatalogs().then(() => live && setIconsReady(true));
    return () => {
      live = false;
    };
  }, []);

  const wantedImages = deferredTab ? imageKey(deferredTab) : '';
  useEffect(() => {
    if (!deferredTab || !wantedImages || !imageContext) return;
    let live = true;
    void loadTabImages(deferredTab, imageContext).then(
      (map) => live && setImages({ key: wantedImages, map }),
    );
    return () => {
      live = false;
    };
    // Keyed on the ids, not the tab: the bitmaps only change when the set of photos does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedImages, imageContext]);

  return useMemo(() => {
    if (!deferredTab) return null;
    // `iconsReady` re-renders once the glyph catalogues land, so icons replace their placeholders.
    void iconsReady;
    const seen = tabAsSeen(deferredTab, appearance);
    const markup = renderTabToSvg(seen, {
      pattern: false,
      images: images?.map,
      ...(plan ? { items: plan.items, itemTypes: plan.types } : {}),
    });
    const size = SIZE.exec(markup);
    return {
      markup,
      width: size ? Number(size[1]) : 800,
      height: size ? Number(size[2]) : 600,
      origin: { x: size ? Number(size[3]) : 0, y: size ? Number(size[4]) : 0 },
      background: seen.backgroundColor ?? '#ffffff',
    };
  }, [deferredTab, appearance, images, plan, iconsReady]);
}
