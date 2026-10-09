'use client';

// A logo page's tools that are each person's own (docs/specs/007-editor/logo-pages.md): Show
// Guides and Mirror While Drawing, each per page (Guides kept in this browser, defaulting to the
// Logo Guides setting; Mirror, with its axis, copies and merge, for the session), the guides'
// parts and strength (synced preferences), and Mirror Copy. The mirrored pages are also read
// through a ref by the draw commits, which add a drawn element's twins on them.
import { useCallback, useMemo, useState, type MutableRefObject } from 'react';
import {
  DEFAULT_MIRROR,
  duplicateElements,
  isBoxed,
  twinFor,
  withMirrorSettings,
  type BoxedElement,
  type Element,
  type LaidOutPage,
  type MirroredPage,
  type MirrorSettings,
  type Tab,
} from '@livediagram/document';
import { track } from '@/lib/telemetry';
import { preloadCombineEngine } from '@/lib/combine/combine';
import { useAssignRef, useLatest } from '@/hooks/ui/useLatest';
import {
  logoGuidePartToken,
  readLogoGuideParts,
  readLogoGuideStrength,
  withLogoGuidePart,
  type LogoGuidePart,
  type LogoGuideStrength,
} from '@/lib/logo-guide-prefs';
import type { UserPreferences } from '@/lib/user-preferences';
import type { GuideSnap } from '@/lib/logo-guide-snapping';
import {
  readLogoPageGuides,
  withLogoPageGuides,
  type LogoPageGuides,
} from '@/lib/logo-page-guides';

export type LogoToolsView = {
  // Whether page `pageId` shows its guides, and switching that page's.
  guidesOn: (pageId: string) => boolean;
  setGuides: (pageId: string, on: boolean) => void;
  // Which guides show and how strongly (synced preferences, lib/logo-guide-prefs.ts).
  guideParts: ReadonlySet<LogoGuidePart>;
  setGuidePart: (part: LogoGuidePart, shown: boolean) => void;
  guideStrength: LogoGuideStrength;
  setGuideStrength: (strength: LogoGuideStrength) => void;
  // Whether Mirror While Drawing is on for page `pageId`, and switching it; the pages it is on for,
  // each with its settings.
  mirrorOn: (pageId: string) => boolean;
  setMirror: (pageId: string, on: boolean) => void;
  mirrorPages: ReadonlyMap<string, MirrorSettings>;
  // Page `pageId`'s mirror settings (its own while on or once set, else the last ones chosen), and
  // changing them.
  mirrorSettings: (pageId: string) => MirrorSettings;
  setMirrorSettings: (pageId: string, patch: Partial<MirrorSettings>) => void;
  // Whether the selection has an element on a logo page to reflect, and doing it.
  canMirrorCopy: () => boolean;
  mirrorCopy: () => void;
  // Snaps a canvas point to the shown guides (a Pen click), null while they are hidden; composed
  // in by useLogoEditor.
  snapPoint?: GuideSnap | null;
};

/** The twins Mirror Copy adds for the selected elements on logo pages: fresh copies (no comments,
 *  actions or votes carried, as Duplicate makes them) reflected across their page's centre line. */
export function mirrorCopies(
  elements: Element[],
  ids: ReadonlySet<string>,
  pages: readonly LaidOutPage[],
): BoxedElement[] {
  const eligible = new Set(
    elements
      .filter((el): el is BoxedElement => ids.has(el.id) && isBoxed(el))
      .filter((el) => twinFor(el, pages, 'copy') !== null)
      .map((el) => el.id),
  );
  if (eligible.size === 0) return [];
  const { newElements } = duplicateElements(elements, eligible, 0, 0);
  return newElements
    .filter((el): el is BoxedElement => isBoxed(el))
    .map((copy) => twinFor(copy, pages, 'copy'))
    .filter((t): t is BoxedElement => t !== null);
}

const NO_PAGES: ReadonlyMap<string, MirrorSettings> = new Map();

/** The logo pages Mirror While Drawing is on for, null when none. */
export function mirroredLogoPages(
  pages: readonly LaidOutPage[],
  tools: LogoToolsView | undefined,
): readonly MirroredPage[] | null {
  if (!tools || tools.mirrorPages.size === 0) return null;
  const out = withMirrorSettings(pages, tools.mirrorPages);
  return out.length > 0 ? out : null;
}

// A settings change's telemetry type: the axis or copies chosen, or merge switched.
function mirrorSettingType(patch: Partial<MirrorSettings>): string | null {
  if (patch.axis) return `LogoMirrorAxis${patch.axis[0]!.toUpperCase()}${patch.axis.slice(1)}`;
  if (patch.copies !== undefined) return `LogoMirrorCopies${patch.copies}`;
  if (patch.merge !== undefined) return patch.merge ? 'LogoMirrorMergeOn' : 'LogoMirrorMergeOff';
  return null;
}

export function useLogoTools({
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
}: {
  // Read by the draw commits (withMirrorTwins): the pages mirror is on for, for this person, now,
  // with their settings.
  mirrorRef: MutableRefObject<ReadonlyMap<string, MirrorSettings>>;
  prefs: UserPreferences;
  // Sets and persists the person's preferences.
  applyPrefs: (next: UserPreferences) => void;
  activeTab: Tab;
  pages: readonly LaidOutPage[] | null;
  currentSelectionIds: () => Set<string>;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  readOnly: boolean;
}): LogoToolsView {
  const [mirrorPages, setMirrorPages] = useState<ReadonlyMap<string, MirrorSettings>>(NO_PAGES);
  // Each page's settings once chosen (kept while its mirror is off), and the last ones chosen
  // anywhere: a page turned on starts from them.
  const [pageMirror, setPageMirror] = useState<ReadonlyMap<string, MirrorSettings>>(NO_PAGES);
  const [lastMirror, setLastMirror] = useState<MirrorSettings>(DEFAULT_MIRROR);
  useAssignRef(mirrorRef, readOnly ? NO_PAGES : mirrorPages);
  const mirrorOn = useCallback((pageId: string) => mirrorPages.has(pageId), [mirrorPages]);
  const mirrorSettings = useCallback(
    (pageId: string) => pageMirror.get(pageId) ?? lastMirror,
    [pageMirror, lastMirror],
  );
  // A page's own Show Guides, else the Logo Guides setting.
  const guidesDefault = prefs.logoGuides !== false;
  const [pageGuides, setPageGuides] = useState<LogoPageGuides>(readLogoPageGuides);
  const guidesOn = useCallback(
    (pageId: string) => pageGuides[pageId] ?? guidesDefault,
    [pageGuides, guidesDefault],
  );
  const guideParts = useMemo(() => readLogoGuideParts(prefs), [prefs]);
  const guideStrength = readLogoGuideStrength(prefs);
  // The same events the Settings rows send (settings-catalogue.ts), so the panel and Settings count
  // as one setting.
  const setGuidePart = useCallback(
    (part: LogoGuidePart, shown: boolean) => {
      track('UI', 'Toggled', `LogoGuide${logoGuidePartToken(part)}${shown ? 'On' : 'Off'}`);
      applyPrefs(withLogoGuidePart(prefs, part, shown));
    },
    [prefs, applyPrefs],
  );
  const setGuideStrength = useCallback(
    (strength: LogoGuideStrength) => {
      track('UI', 'Changed', `LogoGuideStrength${strength[0]!.toUpperCase()}${strength.slice(1)}`);
      applyPrefs({ ...prefs, logoGuideStrength: strength });
    },
    [prefs, applyPrefs],
  );

  // Each switch tracks before it changes, so an off still reaches the wire.
  const setGuides = useCallback((pageId: string, on: boolean) => {
    track('UI', 'Toggled', on ? 'LogoGuidesOn' : 'LogoGuidesOff');
    setPageGuides((current) => withLogoPageGuides(current, pageId, on));
  }, []);
  const setMirror = useCallback(
    (pageId: string, on: boolean) => {
      track('UI', 'Toggled', on ? 'LogoMirrorOn' : 'LogoMirrorOff');
      // Mirror merges a drawing with its twins in the draw's own commit: the engine must be ready.
      if (on) preloadCombineEngine();
      const settings = mirrorSettings(pageId);
      setMirrorPages((current) => {
        const next = new Map(current);
        if (on) next.set(pageId, settings);
        else next.delete(pageId);
        return next;
      });
    },
    [mirrorSettings],
  );
  const setMirrorSettings = useCallback(
    (pageId: string, patch: Partial<MirrorSettings>) => {
      const type = mirrorSettingType(patch);
      if (type) track('UI', 'Changed', type);
      const settings = { ...mirrorSettings(pageId), ...patch };
      if (settings.merge) preloadCombineEngine();
      setPageMirror((current) => new Map(current).set(pageId, settings));
      setLastMirror(settings);
      // A change while on applies at once; choosing an axis also turns mirror on.
      setMirrorPages((current) =>
        current.has(pageId) || patch.axis ? new Map(current).set(pageId, settings) : current,
      );
      if (patch.axis && !mirrorPages.has(pageId)) track('UI', 'Toggled', 'LogoMirrorOn');
    },
    [mirrorSettings, mirrorPages],
  );

  // Read when a menu or command asks: the tab and selection as they are at that moment.
  const latest = useLatest({
    activeTab,
    pages,
    currentSelectionIds,
    commit,
    setSelectedId,
    setMultiSelectedIds,
    readOnly,
  });
  const canMirrorCopy = useCallback(() => {
    const { activeTab: tab, pages: ps, currentSelectionIds: ids, readOnly: ro } = latest.current;
    return !ro && !!ps && tab.locked !== true && mirrorCopies(tab.elements, ids(), ps).length > 0;
  }, [latest]);
  const mirrorCopy = useCallback(() => {
    const l = latest.current;
    if (l.readOnly || !l.pages || l.activeTab.locked === true) return;
    const twins = mirrorCopies(l.activeTab.elements, l.currentSelectionIds(), l.pages);
    if (twins.length === 0) return;
    l.commit((els) => [...els, ...twins]);
    if (twins.length === 1) {
      l.setMultiSelectedIds(new Set());
      l.setSelectedId(twins[0]!.id);
    } else {
      l.setSelectedId(null);
      l.setMultiSelectedIds(new Set(twins.map((t) => t.id)));
    }
    track('Element', 'Changed', 'MirrorCopy');
  }, [latest]);

  const view = useMemo<LogoToolsView>(
    () => ({
      guidesOn,
      setGuides,
      guideParts,
      setGuidePart,
      guideStrength,
      setGuideStrength,
      mirrorOn,
      setMirror,
      mirrorPages,
      mirrorSettings,
      setMirrorSettings,
      canMirrorCopy,
      mirrorCopy,
    }),
    [
      guidesOn,
      setGuides,
      guideParts,
      setGuidePart,
      guideStrength,
      setGuideStrength,
      mirrorOn,
      setMirror,
      mirrorPages,
      mirrorSettings,
      setMirrorSettings,
      canMirrorCopy,
      mirrorCopy,
    ],
  );
  return view;
}
