// The footer's Automations for someone who could edit the item but must first sync it (an item kept Offline) or sign
// in (a guest on a server item) (liveworkspace/docs/specs/018-automations/automations.md "Who may do what"): the
// gate's kind (automationsGateFor), with the app's Sync move, whether the reader is known yet, and the badges the
// Tools row wears meanwhile (the app's own words: Sign In, Sync Plan).

import { useMemo } from 'react';
import { automationsGateFor, type AutomationsGateInput } from './automations-gate';
import type { AutomationsGate } from './AutomationsHost';

export function useAutomationsGate(
  input: AutomationsGateInput & {
    ready: boolean;
    sync: () => Promise<void>;
    // Must be the same list from render to render while what it says is the same.
    badges: readonly string[];
  },
): AutomationsGate | null {
  const kind = automationsGateFor(input);
  const { ready, sync, badges } = input;
  return useMemo<AutomationsGate | null>(
    () =>
      kind === 'sync'
        ? { kind, ready, sync, badges }
        : kind === 'sign_in'
          ? { kind, badges }
          : null,
    [kind, ready, sync, badges],
  );
}
