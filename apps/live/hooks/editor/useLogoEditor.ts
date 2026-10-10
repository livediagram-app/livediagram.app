'use client';

// The editor's wiring for logo pages (docs/specs/007-editor/logo-pages.md), in one place so the
// editor's state hook composes it with a single call: the draw commit that adds mirror twins, each
// person's logo tools, the open previews' picture, Combine, the pages' view with `logo` in it, and
// the snap boxes with a logo page's keylines.
import { useCallback, useMemo, useRef } from 'react';
import {
  illustratePageSnapBoxes,
  logoPageSnapBoxes,
  type Element,
  type LaidOutPage,
  type Tab,
  type MirrorSettings,
} from '@livediagram/document';
import { useTidyUpStrokes } from '@/hooks/canvas/useTidyUpStrokes';
import { useCombineShapes } from '@/hooks/canvas/useCombineShapes';
import type { IllustratePagesView } from '@/hooks/editor/useIllustratePages';
import { useLogoTools } from '@/hooks/editor/useLogoTools';
import { useAssignRef, useLatest } from '@/hooks/ui/useLatest';
import type { useToast } from '@/hooks/ui/useToast';
import {
  logoGuideSnapper,
  logoTidyGuides,
  snapNewStrokes,
  type GuideSnap,
} from '@/lib/logo-guide-snapping';
import { withMirrorTwins } from '@/lib/mirror-commit';
import { writeUserPreferences, type UserPreferences } from '@/lib/user-preferences';

type Commit = (map: (els: Element[]) => Element[]) => void;

export function useLogoEditor<V extends IllustratePagesView>({
  illustrateView,
  pages,
  activeTab,
  commit,
  currentSelectionIds,
  setSelectedId,
  setMultiSelectedIds,
  prefs,
  setPrefs,
  selfId,
  toast,
  readOnly,
  getZoom,
}: {
  // The pages' view while in Illustrate mode, and its laid-out pages; null otherwise.
  illustrateView: V | null;
  pages: readonly LaidOutPage[] | null;
  activeTab: Tab;
  commit: Commit;
  currentSelectionIds: () => Set<string>;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  prefs: UserPreferences;
  setPrefs: (next: UserPreferences) => void;
  selfId: string;
  toast: ReturnType<typeof useToast>;
  readOnly: boolean;
  // The canvas zoom now, for the snap reach in screen px.
  getZoom: () => number;
}) {
  // Mirror While Drawing: the draw tools add through this commit, which gives each new element its
  // reflected twin while mirror is on. A plain function: the refs are read when it commits, never
  // while rendering.
  const mirrorRef = useRef<ReadonlyMap<string, MirrorSettings>>(new Map());
  const pagesRef = useLatest(pages);
  // A stroke drawn near a shown guide starts and ends on it (logo-guide-snapping), before its twin
  // is made, so the twin is snapped too.
  const snapRef = useRef<GuideSnap | null>(null);
  const drawCommit: Commit = (map) =>
    withMirrorTwins(
      commit,
      mirrorRef,
      pagesRef,
    )((els) => snapNewStrokes(els, map(els), snapRef.current, getZoom()));

  // Stable, so the logo view (and the pages that read it) keeps its identity across renders.
  const applyPrefs = useCallback(
    (next: UserPreferences) => {
      setPrefs(next);
      writeUserPreferences(next, selfId);
    },
    [setPrefs, selfId],
  );
  const tools = useLogoTools({
    mirrorRef,
    prefs,
    applyPrefs,
    activeTab,
    pages,
    currentSelectionIds,
    commit,
    setSelectedId,
    setMultiSelectedIds,
    readOnly,
  });
  // The logo pages showing their guides (Show Guides is per page): what draws snap to.
  const guidedPages = useMemo(
    () => pages?.filter((p) => p.kind === 'logo' && tools.guidesOn(p.id)) ?? null,
    [pages, tools],
  );
  // The guides a Pen click and a stroke's ends snap to: the shown ones, on the pages showing them.
  const snapPoint = useMemo(
    () =>
      logoGuideSnapper(guidedPages, {
        on: !!guidedPages?.length,
        parts: tools.guideParts,
      }),
    [guidedPages, tools.guideParts],
  );
  useAssignRef(snapRef, snapPoint);
  const view = useMemo(
    () => (illustrateView ? { ...illustrateView, logo: { ...tools, snapPoint } } : illustrateView),
    [illustrateView, tools, snapPoint],
  );

  const { canCombine, combineSelected } = useCombineShapes({
    activeTab,
    pages,
    currentSelectionIds,
    commit,
    setSelectedId,
    setMultiSelectedIds,
    toast,
    readOnly,
  });

  const { canTidyUp, tidyUpSelected } = useTidyUpStrokes({
    activeTab,
    currentSelectionIds,
    commit,
    readOnly,
    // Corners and straight runs near a shown guide line up with it.
    guides: () => logoTidyGuides(guidedPages, tools.guideParts, getZoom()),
  });

  // Every page's edges, centre and margin, and a logo page's keylines while its guides show.
  const snapBoxes = pages
    ? [...illustratePageSnapBoxes(pages), ...logoPageSnapBoxes(guidedPages ?? [])]
    : null;

  return {
    drawCommit,
    view,
    snapBoxes,
    canCombine,
    combineSelected,
    canTidyUp,
    tidyUpSelected,
  };
}
