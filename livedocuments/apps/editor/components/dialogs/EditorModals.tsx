'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
  newPageBackgroundOf,
  pageUnits,
  pagesOf,
} from '@livedocuments/document';

import { useEditorChrome, useEditorContext } from '@/app/document/[id]/EditorContext';
import { commitUserPreferences } from '@/lib/user-preferences';
import { currentPageIdNow, useCurrentPageKind } from '@/lib/current-page-kind';
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
  } = useEditorContext();
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
    setNewPageBackground,
    applyNewPageBackgroundToEveryPage,
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
          allTabs={
            canApplyStyleToAllTabs
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
