'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
  layOutPages,
  newPageBackgroundOf,
  pageUnits,
  pagesOf,
  tabPageDesignOf,
  type PageBackground,
  type PageDesign,
  type Tab,
} from '@livedocuments/document';
import { useAppearance } from '@livedocuments/ui';
import { TAB_STYLE_KEYS } from '@liveworkspace/workbench/lib/tab-style-to-all';
import { getTheme } from '@/lib/themes';

import { useEditorChrome, useEditorContext } from '@/app/document/[id]/EditorContext';
import { commitUserPreferences } from '@/lib/user-preferences';
import { currentPageIdNow, useCurrentPageId, useCurrentPageKind } from '@/lib/current-page-kind';
import { requestStylePanel } from '@/lib/article/article-editor-store';
import type { TabStylePages } from './tab-style-pages';

const SettingsDialog = dynamic(
  () => import('@/components/dialogs/SettingsDialog').then((m) => m.SettingsDialog),
  { ssr: false },
);
const CanvasThemeDialog = dynamic(
  () => import('@/components/dialogs/CanvasThemeDialog').then((m) => m.CanvasThemeDialog),
  { ssr: false },
);

// The editor's global modal dialogs (settings, canvas theme). Each is gated on its own open flag and reads everything it needs
// straight from EditorContext, so EditorView just drops <EditorModals /> in
// rather than carrying ~45 lines of dialog wiring. Comment/link/image
// popovers stay inline in EditorView — they're anchored to canvas elements,
// not global modals.
// Settings and the canvas theme dialog, open or not.
// Only whether one is open is read until it is (docs/specs/007-editor/blueprints/flashcards.md "Performance and
// limits"): a typing commit renders nothing here.
export function EditorModals() {
  const open = useEditorChrome(
    (s) => s.settingsOpen || (s.canvasThemeTab !== null && !s.isReadOnly),
  );
  return open ? <OpenEditorModals /> : null;
}

function OpenEditorModals() {
  const {
    settingsOpen,
    settingsFocus,
    settingsCategory,
    settingsSection,
    closeSettings,
    userPreferences,
    setUserPreferences,
    selfParticipant,
    canvasThemeTab,
    isReadOnly,
    activeTab,
    setCanvasThemeTab,
    setBackgroundPattern,
    setBackgroundColor,
    setPatternColor,
    setBackgroundOpacity,
    setBackgroundPatternScale,
    setBackgroundAnimationSpeed,
    setTheme,
    setTabFont,
    setTabDefaultTextSize,
    setTabFinish,
    applyTabLook,
    tabs,
    applyStyleToAllTabs,
    applyingStyleToAllTabs,
    canApplyStyleToAllTabs,
    setNewPageBackground,
    applyNewPageBackgroundToEveryPage,
    setEveryPageBackground,
    setPageStyle,
    pagesMode,
    pageDesignEdits,
  } = useEditorContext();
  const pageId = useCurrentPageId();
  // Copy to All Tabs while another tab wears a different style, kept for the dialog's opening once offered, so its
  // Copied shows after the copy makes every tab alike.
  const opening = canvasThemeTab === null ? null : activeTab.id;
  // Only while the dialog is open: closed, no tab is compared.
  const tabsDiffer = useMemo(
    () => opening !== null && tabs.some((t) => !sameTabStyle(t, activeTab)),
    [opening, tabs, activeTab],
  );
  const [copyOpening, setCopyOpening] = useState<string | null>(null);
  if (tabsDiffer && opening && copyOpening !== opening) setCopyOpening(opening);
  if (!opening && copyOpening !== null) setCopyOpening(null);
  const copyOffered = tabsDiffer || (opening !== null && copyOpening === opening);
  const { appearance } = useAppearance();
  // The page someone is on is the Tab Style surface; a tab with no pages yet is the canvas.
  const pageKind = useCurrentPageKind();
  // What the dialog knows of the tab's pages (tab-style-pages.ts), worked out when the tab or the page kind changes.
  const pages = useMemo<TabStylePages>(() => {
    const own = newPageBackgroundOf(activeTab);
    const written = pageKind === 'article' || pageKind === 'flashcard';
    return {
      kind: pageKind,
      newPageBackground: own,
      themeId: activeTab.theme ?? 'brand',
      units: activeTab.pages?.length ? pageUnits(pagesOf(activeTab)).length : 0,
      onSet: setNewPageBackground,
      onApplyToEveryPage: applyNewPageBackgroundToEveryPage,
      ...(activeTab.pages?.length
        ? {
            // The Page Design panel's door (page-design/page-design-door.ts).
            design: (() => {
              const row = layOutPages(pagesOf(activeTab));
              return {
                tabDesign: tabPageDesignOf(activeTab),
                page: row.find((p) => p.id === pageId) ?? row[0],
                pages: row,
                elements: activeTab.elements,
                theme: getTheme(activeTab.theme),
                tabFont: activeTab.font ?? undefined,
                paperDark: appearance === 'dark',
                edits: pageDesignEdits,
              };
            })(),
          }
        : {}),
      ...(activeTab.pages?.length
        ? {
            // Page Design's Background layer (tab-style-pages.ts).
            background: (() => {
              const stored = pagesOf(activeTab);
              const page = stored.find((p) => p.id === pageId) ?? stored[0]!;
              return {
                page,
                onAll: setEveryPageBackground,
                // With a design, the background and the page's own design in one step (a Quick Pick).
                onPage: (patch: Partial<PageBackground>, design?: PageDesign) =>
                  design
                    ? setPageStyle(page.id, patch, design)
                    : pagesMode?.edit?.setBackground(page.id, patch),
              };
            })(),
          }
        : {}),
      ...(written
        ? {
            // The Style beside the page's cog, for the page someone is on, once the dialog has gone.
            onOpenArticleStyle: () => {
              const pageId = currentPageIdNow();
              setCanvasThemeTab(null);
              if (pageId) requestStylePanel(pageId);
            },
          }
        : {}),
    };
  }, [
    activeTab,
    pageKind,
    pageId,
    appearance,
    pageDesignEdits,
    setNewPageBackground,
    applyNewPageBackgroundToEveryPage,
    setEveryPageBackground,
    setPageStyle,
    pagesMode,
    setCanvasThemeTab,
  ]);

  return (
    <>
      {settingsOpen ? (
        <SettingsDialog
          settings={userPreferences}
          onChange={(next) => {
            // Pass the resolved owner id so the new prefs round-trip
            // to D1 (docs/specs/007-editor/user-preferences.md). selfParticipant?.id is null until the
            // identity effect resolves it, but settingsOpen can't be
            // true until the user clicks the gear, which only renders
            // after that effect ran, so the id is always set here.
            // The row built `next` on this render's preferences; only its change is written, onto
            // the freshest, so another tab's change since is kept.
            setUserPreferences(
              commitUserPreferences(userPreferences, next, selfParticipant?.id ?? null),
            );
          }}
          onClose={closeSettings}
          focus={settingsFocus}
          initialCategoryId={settingsCategory}
          initialSectionId={settingsSection}
        />
      ) : null}
      {canvasThemeTab !== null && !isReadOnly ? (
        <CanvasThemeDialog
          pages={pages}
          tab={canvasThemeTab}
          surface={pageKind ?? 'canvas'}
          onTabChange={setCanvasThemeTab}
          backgroundPattern={activeTab.backgroundPattern ?? 'grid'}
          backgroundColor={activeTab.backgroundColor ?? DEFAULT_BACKGROUND_COLOR}
          patternColor={activeTab.patternColor ?? DEFAULT_PATTERN_COLOR}
          backgroundOpacity={activeTab.backgroundOpacity ?? 1}
          backgroundPatternScale={activeTab.backgroundPatternScale ?? 1}
          backgroundAnimationSpeed={activeTab.backgroundAnimationSpeed ?? 1}
          onSetBackgroundPattern={setBackgroundPattern}
          onSetBackgroundColor={setBackgroundColor}
          onSetPatternColor={setPatternColor}
          onSetBackgroundOpacity={setBackgroundOpacity}
          onSetBackgroundPatternScale={setBackgroundPatternScale}
          onSetBackgroundAnimationSpeed={setBackgroundAnimationSpeed}
          themeId={activeTab.theme ?? 'brand'}
          onSetTheme={setTheme}
          font={activeTab.font ?? null}
          onSetFont={setTabFont}
          defaultTextSize={activeTab.defaultTextSize}
          onSetDefaultTextSize={setTabDefaultTextSize}
          finish={activeTab.finish}
          onSetFinish={setTabFinish}
          canvasBackground={activeTab.backgroundColor}
          onApplyLook={applyTabLook}
          // Copy to All Tabs, a row of Page Design's foot (owner, 2026-11-25).
          allTabs={
            // Only while another tab wears a different style (owner, 2026-11-25).
            canApplyStyleToAllTabs && tabs.length > 1 && copyOffered
              ? {
                  tabCount: tabs.length,
                  applying: applyingStyleToAllTabs,
                  onApply: () => void applyStyleToAllTabs(),
                }
              : undefined
          }
          onClose={() => setCanvasThemeTab(null)}
        />
      ) : null}
    </>
  );
}

// Whether two tabs wear the same style: the theme, every style setting Copy to All Tabs copies, and what their pages
// wear (the backgrounds and own designs it re-inks).
function sameTabStyle(a: Tab, b: Tab): boolean {
  const x = a as unknown as Record<string, unknown>;
  const y = b as unknown as Record<string, unknown>;
  const worn = (t: Tab) =>
    JSON.stringify(
      [
        ...new Set(pagesOf(t).map((p) => JSON.stringify([p.background ?? null, p.design ?? null]))),
      ].sort(),
    );
  return (
    ['theme', ...TAB_STYLE_KEYS].every(
      (k) => JSON.stringify(x[k] ?? null) === JSON.stringify(y[k] ?? null),
    ) && worn(a) === worn(b)
  );
}
