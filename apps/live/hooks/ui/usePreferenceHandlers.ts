import { track } from '@/lib/telemetry';
import {
  resolvePanelLayout,
  withPanelLayout,
  writeUserPreferences,
  type UserPreferences,
} from '@/lib/user-preferences';

// The Canvas's user-preference write handlers (docs/specs/007-editor/user-preferences.md), lifted out of
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
    // Minimal on / off. Off lands on Floating (docs/specs/007-editor/toolbar-layout.md); from Toolbar it
    // turns Minimal on, since Toolbar is not the docked layout.
    const next = withPanelLayout(
      userPreferences,
      resolvePanelLayout(userPreferences) === 'minimal' ? 'floating' : 'minimal',
    );
    track('UI', 'Toggled', next.minimalPanels ? 'MinimalPanelsOn' : 'MinimalPanelsOff');
    persist(next);
  };

  return { onChangeSettings, onToggleMinimalPanels };
}
