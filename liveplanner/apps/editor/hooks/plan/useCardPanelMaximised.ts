// Maximise Card (docs/specs/026-plan/plan-board.md "Maximised"): whether this person's item panel opens filling the
// window, kept with their preferences (`cardPanelMaximised`) so every card they open afterwards, on any device,
// opens the same way. Read live from the device cache, which the server copy is merged into at load; written by
// rebasing the change onto that cache, so another tab's preference written since is kept.
import { useCallback } from 'react';
import { useCachedPreferences } from '@/hooks/persistence/useEditorPreferences';
import { commitUserPreferences, readUserPreferences } from '@/lib/user-preferences';
import { track } from '@/lib/telemetry';

export function useCardPanelMaximised(ownerId: string | null): {
  maximised: boolean;
  setMaximised: (on: boolean) => void;
} {
  const prefs = useCachedPreferences();
  const setMaximised = useCallback(
    (on: boolean) => {
      // Tracked before the write, as every preference flip is (docs/specs/017-telemetry/telemetry.md).
      track('UI', 'Toggled', on ? 'CardMaximisedOn' : 'CardMaximisedOff');
      const latest = readUserPreferences();
      const next = { ...latest };
      if (on) next.cardPanelMaximised = true;
      // Off is the default, so it is stored as no key at all.
      else delete next.cardPanelMaximised;
      commitUserPreferences(latest, next, ownerId);
    },
    [ownerId],
  );
  return { maximised: prefs.cardPanelMaximised === true, setMaximised };
}
