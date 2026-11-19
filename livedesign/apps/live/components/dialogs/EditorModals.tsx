'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
  newPageBackgroundOf,
  pageKindOf,
  pagesOf,
} from '@livedesign/design';

import { useEditorContext } from '@/app/design/[id]/EditorContext';
import { commitUserPreferences } from '@/lib/user-preferences';
import { useCurrentPageKind } from '@/lib/current-page-kind';

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
export function EditorModals() {
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
    setKeepElementColours,
  } = useEditorContext();
  // The page someone is on is the Tab Style surface; a page nobody has chosen a kind for is the canvas.
  const pageKind = useCurrentPageKind();
  // What the dialog knows of the tab's pages (tab-style-pages.ts), worked out when the tab or the page kind changes.
  const pages = useMemo(
    () => ({
      kind: pageKind,
      newPageBackground: newPageBackgroundOf(activeTab),
      themeId: activeTab.theme ?? 'brand',
      units: pagesOf(activeTab).filter((p) => pageKindOf(p) !== 'photo').length,
      onSet: setNewPageBackground,
      onApplyToEveryPage: applyNewPageBackgroundToEveryPage,
      // Element Colours, the tab's own (docs/specs/011-theme/canvas-and-theme-dialog.md "Element colours").
      keepElementColours: activeTab.keepElementColours === true,
      onSetKeepElementColours: setKeepElementColours,
    }),
    [
      activeTab,
      pageKind,
      setNewPageBackground,
      applyNewPageBackgroundToEveryPage,
      setKeepElementColours,
    ],
  );

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
