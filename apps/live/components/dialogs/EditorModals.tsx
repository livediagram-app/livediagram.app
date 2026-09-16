'use client';

import dynamic from 'next/dynamic';
import { DEFAULT_BACKGROUND_COLOR, DEFAULT_PATTERN_COLOR } from '@livediagram/diagram';

import { useEditorContext } from '@/app/diagram/[id]/EditorContext';

const ShortcutsDialog = dynamic(() =>
  import('@/components/dialogs/ShortcutsDialog').then((m) => m.ShortcutsDialog),
);
const SettingsDialog = dynamic(() =>
  import('@/components/dialogs/SettingsDialog').then((m) => m.SettingsDialog),
);
const PhotoImportDialog = dynamic(() =>
  import('@/components/dialogs/PhotoImportDialog').then((m) => m.PhotoImportDialog),
);
const CanvasThemeDialog = dynamic(() =>
  import('@/components/dialogs/CanvasThemeDialog').then((m) => m.CanvasThemeDialog),
);

// The editor's global modal dialogs (keyboard shortcuts, settings, canvas
// theme). Each is gated on its own open flag and reads everything it needs
// straight from EditorContext, so EditorView just drops <EditorModals /> in
// rather than carrying ~45 lines of dialog wiring. Comment/link/image
// popovers stay inline in EditorView — they're anchored to canvas elements,
// not global modals.
export function EditorModals() {
  const {
    shortcutsOpen,
    shortcutsEnabled,
    setShortcutsEnabled,
    setShortcutsOpen,
    settingsOpen,
    userPreferences,
    setUserPreferences,
    writeUserPreferences,
    selfParticipant,
    aiCapable,
    setSettingsOpen,
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
    resetElementsToTheme,
    photoImport,
    photoImportOpen,
    closePhotoImport,
  } = useEditorContext();

  return (
    <>
      {shortcutsOpen ? (
        <ShortcutsDialog
          enabled={shortcutsEnabled}
          onToggleEnabled={setShortcutsEnabled}
          onClose={() => setShortcutsOpen(false)}
        />
      ) : null}
      {settingsOpen ? (
        <SettingsDialog
          settings={userPreferences}
          onChange={(next) => {
            setUserPreferences(next);
            // Pass the resolved owner id so the new prefs round-trip
            // to D1 (spec/20). selfParticipant?.id is null until the
            // identity effect resolves it, but settingsOpen can't be
            // true until the user clicks the gear, which only renders
            // after that effect ran, so the id is always set here.
            writeUserPreferences(next, selfParticipant?.id ?? null);
          }}
          onClose={() => setSettingsOpen(false)}
          aiCapable={aiCapable}
        />
      ) : null}
      {canvasThemeTab !== null && !isReadOnly ? (
        <CanvasThemeDialog
          tab={canvasThemeTab}
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
          onResetElementsToTheme={resetElementsToTheme}
          onClose={() => setCanvasThemeTab(null)}
        />
      ) : null}
      {/* Reading a photographed wall (spec/139 Phase 8). Lazy, like the other
          heavy dialogs: the overwhelming majority of sessions never open it,
          and on a board without a model key it does not exist at all. */}
      {photoImportOpen ? (
        <PhotoImportDialog
          open
          state={photoImport.state}
          onPickFile={(file) => void photoImport.read(file)}
          onSetIncluded={photoImport.setIncluded}
          onEditNote={photoImport.editNote}
          onCommit={photoImport.commit}
          onAgain={photoImport.again}
          onClose={closePhotoImport}
        />
      ) : null}
    </>
  );
}
