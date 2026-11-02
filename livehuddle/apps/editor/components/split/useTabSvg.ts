'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { Tab } from '@livehuddle/document';
import { tabAsSeen } from '@/lib/export-as-seen';
import { loadTabImages, renderTabToSvg } from '@/lib/export-tab';
import { tabImageKey, type ExportImageMap } from '@/lib/export-tab-images';
import { ensureIconCatalogs } from '@liveworkspace/workbench/lib/icon-registry';
import { svgFrameOf } from '@liveworkspace/workbench/lib/svg-frame';
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

// A tab drawn as the editor would show it (docs/specs/007-editor/split-view.md "The right pane"):
// the export renderer's SVG, in the viewer's appearance, with the
// tab's photos. Re-rendered when the tab changes (an edit, a collaborator's op) at a deferred
// priority, so a burst of remote edits never competes with the editor beside it.
//
// Drawn by renderTabToSvg, as an export draws it.
export function useTabSvg(tab: Tab | undefined): TabSvg | null {
  const { imageContext } = useEditorContext();
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

  const wantedImages = deferredTab ? tabImageKey(deferredTab) : '';
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
    // oxlint-disable-next-line react/exhaustive-deps
  }, [wantedImages, imageContext]);

  return useMemo(() => {
    if (!deferredTab) return null;
    // `iconsReady` re-renders once the glyph catalogues land, so icons replace their placeholders.
    void iconsReady;
    const seen = tabAsSeen(deferredTab, appearance);
    const markup = renderTabToSvg(seen, {
      pattern: false,
      images: images?.map,
    });
    return {
      markup,
      ...svgFrameOf(markup),
      background: seen.backgroundColor ?? '#ffffff',
    };
  }, [deferredTab, appearance, images, iconsReady]);
}
