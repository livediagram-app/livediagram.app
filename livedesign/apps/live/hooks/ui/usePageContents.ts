'use client';

// Pages mode's Contents as state (docs/specs/007-editor/pages-mode.md "Contents"): the shared hook
// (@liveworkspace/workbench/hooks/ui/usePageContents) bound to this editor's pages. What is
// livedesign's own is handed in here: the rows (a wireframe's device), the words on each page, where
// a dropped page lands, the page Add Page copies (the last of the tab's kind, "One kind a tab"), Add
// Page's device for a wireframe screen, and the pictures (a photo page's is its picture).
import { useCallback, useMemo } from 'react';
import {
  lastPageOfTabKind,
  MAX_PAGES,
  type LaidOutPage,
  type PageKind,
  type WireframeDeviceId,
} from '@livedesign/design';
import {
  usePageContents as useSharedPageContents,
  type PageContents as SharedPageContents,
} from '@liveworkspace/workbench/hooks/ui/usePageContents';
import { usePageThumbnails, type PageThumbTab } from '@/hooks/ui/usePageThumbnails';
import { usePhotoThumbHrefs } from '@/components/photo/usePhotoThumbHrefs';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { contentsDropUnit, contentsRows, type ContentsRow } from '@/lib/page-contents';
import { pageTexts } from '@/lib/page-texts';
import { track } from '@/lib/telemetry';
import { requestPagePanel } from '@/lib/page-panel-request';

export function usePageContents({
  view,
  tab,
  here,
  settleMs = 0,
  onWent,
}: {
  view: PagesModeView;
  tab: PageThumbTab;
  // The page in view as the list opens, scrolled to and marked.
  here: string | undefined;
  // How long the tab rests before the thumbnails redraw (usePageThumbnails); 0 redraws at once.
  settleMs?: number;
  // After a press went to a page (the phone's sheet closes then).
  onWent?: () => void;
}): PageContents {
  const { pages } = view;
  const rows = useMemo(() => contentsRows(pages), [pages]);
  const readTexts = useCallback(() => pageTexts(pages, tab.elements), [pages, tab.elements]);
  const contents = useSharedPageContents({
    view,
    rows,
    readTexts,
    dropUnit: (id, drop) => contentsDropUnit(pages, id, drop),
    // Another page like the last of the tab's kind (its kind and shape; a wireframe page's device and
    // frame too): "One kind a tab". None on a tab whose first page is still blank.
    lastPage: lastPageOfTabKind(pages),
    maxPages: MAX_PAGES,
    openSettings: requestPagePanel,
    track: (type) => track('UI', 'Used', type),
    here,
    onWent,
  });
  // A photo page's thumbnail is its picture (its preview), as the canvas and the exports show it.
  const photoHrefs = usePhotoThumbHrefs(view.photo, contents.drawnIds);
  const thumbs = usePageThumbnails(tab, contents.drawnIds, settleMs, photoHrefs);
  return { ...contents, thumbs };
}

export type PageContents = SharedPageContents<
  ContentsRow,
  LaidOutPage,
  [kind: PageKind, device?: WireframeDeviceId]
>;
