'use client';

// The editor's wiring for logo pages (docs/specs/007-editor/logo-pages.md), in one place so the
// editor's state hook composes it with a single call: the draw commit that adds mirror twins, each
// person's logo tools, the open previews' picture, the pages' view with `logo` in it, and the snap
// boxes with a logo page's keylines.
import { useCallback, useMemo, useRef } from 'react';
import {
  pageSnapBoxes,
  logoPageSnapBoxes,
  type Element,
  type LaidOutPage,
  type Tab,
  type MirrorSettings,
} from '@livepages/document';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { useLogoTools } from '@/hooks/editor/useLogoTools';
import { useAssignRef, useLatest } from '@/hooks/ui/useLatest';
import { logoGuideSnapper, snapNewStrokes, type GuideSnap } from '@/lib/logo-guide-snapping';
import { withMirrorTwins } from '@/lib/mirror-commit';
import { commitUserPreferences, type UserPreferences } from '@/lib/user-preferences';

type Commit = (map: (els: Element[]) => Element[]) => void;

export function useLogoEditor<V extends PagesModeView>({
  pagesModeView,
  pages,
  activeTab,
  commit,
  currentSelectionIds,
  setSelectedId,
  setMultiSelectedIds,
  prefs,
  setPrefs,
  selfId,
  readOnly,
  getZoom,
}: {
  // The pages' view, and its laid-out pages.
  pagesModeView: V;
  pages: readonly LaidOutPage[];
  activeTab: Tab;
  commit: Commit;
  currentSelectionIds: () => Set<string>;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  prefs: UserPreferences;
  setPrefs: (next: UserPreferences) => void;
  selfId: string;
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
  // The tools build `next` on this render's preferences; it is moved onto the freshest before the
  // whole blob is written, so another tab's change since is kept.
  const prefsRef = useLatest(prefs);
  const applyPrefs = useCallback(
    (next: UserPreferences) => setPrefs(commitUserPreferences(prefsRef.current, next, selfId)),
    [setPrefs, selfId, prefsRef],
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
    () => pages.filter((p) => p.kind === 'logo' && tools.guidesOn(p.id)),
    [pages, tools],
  );
  // The guides a stroke's ends snap to: the shown ones, on the pages showing them.
  const snapPoint = useMemo(
    () =>
      logoGuideSnapper(guidedPages, {
        on: guidedPages.length > 0,
        parts: tools.guideParts,
      }),
    [guidedPages, tools.guideParts],
  );
  useAssignRef(snapRef, snapPoint);
  const view = useMemo(() => ({ ...pagesModeView, logo: tools }), [pagesModeView, tools]);

  // Every page's edges, centre and margin, and a logo page's keylines while its guides show.
  const snapBoxes = [...pageSnapBoxes(pages), ...logoPageSnapBoxes(guidedPages)];

  return {
    drawCommit,
    view,
    snapBoxes,
  };
}
