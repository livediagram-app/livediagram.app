// The footer's Automations for someone who could edit the plan but must first sync it (a plan in This Browser) or
// sign in (a guest on a server plan) (docs/specs/026-plan/automations.md "Who may do what"): the gate's kind
// (automationsGateFor), with the Sync Plan move Share's gate uses and whether the reader is known yet.

import { useMemo } from 'react';
import { automationsGateFor } from './automations-gate';
import type { AutomationsGate } from './AutomationsHost';

export function useAutomationsGate(
  input: Parameters<typeof automationsGateFor>[0] & { ready: boolean; sync: () => Promise<void> },
): AutomationsGate | null {
  const kind = automationsGateFor(input);
  const { ready, sync } = input;
  return useMemo<AutomationsGate | null>(
    () => (kind === 'sync' ? { kind, ready, sync } : kind === 'sign_in' ? { kind } : null),
    [kind, ready, sync],
  );
}
