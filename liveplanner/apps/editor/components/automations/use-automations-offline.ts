// The footer's Automations on a plan in Browser Storage (docs/specs/026-plan/automations.md "Who may do what"): set
// for whoever can edit it (automationsOfflineFor), with where a guest signs in and the Sync Plan to Server move.

import { useMemo } from 'react';
import { useAuthHrefs } from '@/components/chrome/auth-shared';
import type { AccessLevel } from '@liveplanner/api-schema';
import { automationsOfflineFor } from './automations-gate';
import type { AutomationsOffline } from './AutomationsHost';

export function useAutomationsOffline(input: {
  level: AccessLevel;
  structureReadOnly: boolean;
  offline: boolean;
  hydrated: boolean;
  embed: boolean;
  signedIn: boolean;
  save: () => Promise<void>;
}): AutomationsOffline | null {
  const { signInHref } = useAuthHrefs();
  const shown = automationsOfflineFor(input);
  const { signedIn, save } = input;
  return useMemo(
    () => (shown ? { signedIn, signInHref, save } : null),
    [shown, signedIn, signInHref, save],
  );
}
