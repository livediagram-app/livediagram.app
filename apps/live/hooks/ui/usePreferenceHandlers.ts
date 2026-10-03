import { writeUserPreferences, type UserPreferences } from '@/lib/user-preferences';

// The Canvas's user-preference write handlers (docs/specs/007-editor/user-preferences.md), lifted out of
// EditorCanvasHost: the Settings dialog's whole-object save. It sets the
// in-memory state then persists via writeUserPreferences with the
// participant id.
export function usePreferenceHandlers({
  setUserPreferences,
  selfParticipantId,
}: {
  setUserPreferences: (next: UserPreferences) => void;
  selfParticipantId: string | null;
}) {
  const onChangeSettings = (next: UserPreferences) => {
    setUserPreferences(next);
    writeUserPreferences(next, selfParticipantId);
  };

  return { onChangeSettings };
}
