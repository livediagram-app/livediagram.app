'use client';

import dynamic from 'next/dynamic';
import { useCallback } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useEditorChrome, useEditorContext } from '@/app/document/[id]/EditorContext';
import { commitUserPreferences } from '@/lib/user-preferences';
import { useStyleOffered } from '@/components/knowledge-style/useStyleOffered';

const SettingsDialog = dynamic(
  () => import('@/components/dialogs/SettingsDialog').then((m) => m.SettingsDialog),
  { ssr: false },
);
// Knowledgebase Style (docs/specs/030-knowledgebase/page-surface.md "Knowledgebase Style"): one chunk, fetched on
// its first open.
const KnowledgeStyleDialog = dynamic(
  () =>
    import('@/components/knowledge-style/KnowledgeStyleDialog').then((m) => m.KnowledgeStyleDialog),
  { ssr: false },
);

// The editor's global modal dialogs (settings, Knowledgebase Style). Each is gated on its own open flag and reads everything it needs
// straight from EditorContext, so EditorView just drops <EditorModals /> in
// rather than carrying ~45 lines of dialog wiring. Comment/link/image
// popovers stay inline in EditorView — they're anchored to canvas elements,
// not global modals.
// Settings and Knowledgebase Style, open or not.
// Only whether one is open is read until it is (docs/specs/007-editor/blueprints/typing.md "Performance and
// limits"): a typing commit renders nothing here.
export function EditorModals() {
  // Knowledgebase Style is an Editor's alone: a Participant, a Viewer, an embed and a link confined to one page
  // never reach it, whatever opened it.
  const styleOffered = useStyleOffered();
  const open = useEditorChrome(
    (s) => s.settingsOpen || (s.canvasThemeTab !== null && styleOffered),
  );
  return open ? <OpenEditorModals styleOffered={styleOffered} /> : null;
}

function OpenEditorModals({ styleOffered }: { styleOffered: boolean }) {
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
    setCanvasThemeTab,
  } = useEditorContext();
  // Stable, so the dialog's profile is built once a style.
  const setTab = useLatest(setCanvasThemeTab);
  const closeStyle = useCallback(() => setTab.current(null), [setTab]);

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
      {canvasThemeTab !== null && styleOffered ? (
        <KnowledgeStyleDialog
          view={canvasThemeTab}
          onViewChange={setCanvasThemeTab}
          onClose={closeStyle}
        />
      ) : null}
    </>
  );
}
