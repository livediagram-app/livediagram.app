// Who sees Automations (docs/specs/026-plan/automations.md "Who may do what"): an Editor of the whole plan, on a plan
// saved to an account. A Participant, a Viewer, a tab-scoped link, an embed and a plan in Browser Storage see no
// button and no Run Rule; the api refuses them all the same (403 `automations_need_editor`), so this is
// presentation, never the rule. Pure.

import type { AccessLevel } from '@liveplanner/api-schema';
import type { AutomationsScope } from './automations-client';

export function automationsScopeFor(input: {
  level: AccessLevel;
  // Read-only for structure (a Viewer, a Participant, or a link scoped to one tab).
  structureReadOnly: boolean;
  // A plan saved only in this browser: no alarm to run rules on.
  offline: boolean;
  hydrated: boolean;
  embed: boolean;
  scope: {
    ownerId: string;
    projectId: string;
    shareCode: string | null;
    tabId: string | null;
  } | null;
}): AutomationsScope | null {
  const { level, structureReadOnly, offline, hydrated, embed, scope } = input;
  if (!scope || !hydrated || embed || offline || structureReadOnly || level !== 'edit') return null;
  if (scope.tabId !== null) return null;
  return { ownerId: scope.ownerId, projectId: scope.projectId, shareCode: scope.shareCode };
}
