'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { canvasSurface, tabWindowNames, type Tab } from '@livedesign/design';
import { tabAsSeen } from '@/lib/export-as-seen';
import { loadTabImages } from '@/lib/export-tab';
import { renderTabDrawingSvg } from '@/lib/tab-drawing';
import { tabImageKey, type ExportImageMap } from '@/lib/export-tab-images';
import type { SvgMotion } from '@/lib/export-tab';
import { ensureIconCatalogs } from '@/lib/icon-registry';
import { svgFrameOf } from '@liveworkspace/workbench/lib/svg-frame';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { useEditorContext } from '@/app/design/[id]/EditorContext';

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
// the export renderer's SVG, in the viewer's appearance, with the tab's photos. Re-rendered when the tab changes (an edit, a collaborator's op) at a deferred
// priority, so a burst of remote edits never competes with the editor beside it.
//
// `motionFor` sets the drawing moving (a tab window, docs/specs/009-elements/tab-window.md "The drawing"): given the
// drawn tab's surface, it says how each element animates. Without it the drawing is a still, as the side pane's is.
// Pass a module-level function so its identity is stable.
//
// Drawn by renderTabDrawingSvg: a Pages tab as its pages, so a window and the other pane show a tab the same way.
export function useTabSvg(
  tab: Tab | undefined,
  motionFor?: (surface: ReturnType<typeof canvasSurface>) => SvgMotion,
): TabSvg | null {
  const { imageContext, tabs } = useEditorContext();
  // A window inside this tab is named for the tab it shows, as the export names it. Keyed on the tabs' names, not the
  // tabs, so an edit anywhere in the design does not redraw this one.
  const nameKey = tabs.map((t) => `${t.id}\u0000${t.name}`).join('\u0001');
  // oxlint-disable-next-line react/exhaustive-deps
  const windowNames = useMemo(() => tabWindowNames(tabs), [nameKey]);
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
    const markup = renderTabDrawingSvg(seen, {
      pattern: false,
      motion: motionFor?.(canvasSurface(seen.backgroundColor)),
      images: images?.map,
      resolveTabWindow: windowNames,
    });
    return {
      markup,
      ...svgFrameOf(markup),
      background: seen.backgroundColor ?? '#ffffff',
    };
  }, [deferredTab, appearance, images, iconsReady, windowNames, motionFor]);
}
