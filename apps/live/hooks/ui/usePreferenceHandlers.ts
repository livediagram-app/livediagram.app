import { track } from '@/lib/telemetry';
import { writeUserPreferences, type UserPreferences } from '@/lib/user-preferences';

// The Canvas's user-preference write handlers (spec/20), lifted out of
// EditorCanvasHost: the Settings dialog's whole-object save and the two
// quick toggles (minimal panels, pencil shape recognition). Every path
// sets the in-memory state then persists via writeUserPreferences with
// the participant id.
export function usePreferenceHandlers({
  userPreferences,
  setUserPreferences,
  selfParticipantId,
}: {
  userPreferences: UserPreferences;
  setUserPreferences: (next: UserPreferences) => void;
  selfParticipantId: string | null;
}) {
  const persist = (next: UserPreferences) => {
    setUserPreferences(next);
    writeUserPreferences(next, selfParticipantId);
  };

  const onChangeSettings = (next: UserPreferences) => persist(next);

  const onToggleMinimalPanels = () => {
    const next: UserPreferences = {
      ...userPreferences,
      minimalPanels: !(userPreferences.minimalPanels === true),
    };
    track('UI', 'Toggled', next.minimalPanels ? 'MinimalPanelsOn' : 'MinimalPanelsOff');
    persist(next);
  };

  return { onChangeSettings, onToggleMinimalPanels };
}
