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

  const onToggleRecogniseShapes = () => {
    const next: UserPreferences = {
      ...userPreferences,
      // Default-on: undefined / true read as on, so toggling off
      // stores an explicit false.
      recogniseShapes: userPreferences.recogniseShapes === false,
    };
    // Telemetry (spec/22): emit BEFORE persistence so the
    // flip itself reaches the wire even when the new state
    // would suppress emission later (matches how
    // TelemetryOn / TelemetryOff are handled in the
    // Settings dialog).
    track('UI', 'Toggled', next.recogniseShapes ? 'RecogniseShapesOn' : 'RecogniseShapesOff');
    persist(next);
  };

  return { onChangeSettings, onToggleMinimalPanels, onToggleRecogniseShapes };
}
