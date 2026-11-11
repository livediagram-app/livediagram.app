// Who sees Automations (docs/specs/026-plan/automations.md "Who may do what"): an Editor of the whole plan, on a plan
// saved to an account, signed in. A Participant, a Viewer, a tab-scoped link and an embed see no button and no Run
// Rule; the api refuses them all the same (403 `automations_need_editor`), so this is presentation, never the rule.
// Whoever could edit the plan but for where it lives or who they are still sees the button, which opens a gate
// (automationsGateFor): Sync Plan on a plan in This Browser, Sign In for a guest. Pure.

import type { AccessLevel } from '@liveplanner/api-schema';
import type { AutomationsScope } from './automations-client';

type GateInput = {
  level: AccessLevel;
  // Read-only for structure (a Viewer, a Participant, or a link scoped to one tab).
  structureReadOnly: boolean;
  // A plan saved only in this browser: no alarm to run rules on.
  offline: boolean;
  hydrated: boolean;
  embed: boolean;
  // Whether the reader has an account (the api's gate needs one), and whether sign-in has answered yet.
  signedIn: boolean;
  authLoaded: boolean;
  scope: {
    ownerId: string;
    projectId: string;
    shareCode: string | null;
    tabId: string | null;
  } | null;
};

const canEditWhole = (input: GateInput) =>
  input.hydrated &&
  !input.embed &&
  !input.structureReadOnly &&
  input.level === 'edit' &&
  (input.scope === null || input.scope.tabId === null);

/** The screen's scope: a signed-in Editor of the whole plan saved to an account. */
export function automationsScopeFor(input: GateInput): AutomationsScope | null {
  const { scope } = input;
  if (!scope || input.offline || !input.signedIn || !canEditWhole(input)) return null;
  return { ownerId: scope.ownerId, projectId: scope.projectId, shareCode: scope.shareCode };
}

/** What stands before the screen for someone who could edit the plan: Sync Plan on a plan in This Browser, Sign In
 *  for a guest on a server plan (once sign-in has answered), else nothing. */
export type AutomationsGateKind = 'sync' | 'sign_in';
export function automationsGateFor(input: GateInput): AutomationsGateKind | null {
  if (!canEditWhole(input)) return null;
  if (input.offline) return 'sync';
  if (input.scope && input.authLoaded && !input.signedIn) return 'sign_in';
  return null;
}

// The query that opens the screen on arrival: where a guest's sign-in comes back to.
export const AUTOMATIONS_PARAM = 'automations';
