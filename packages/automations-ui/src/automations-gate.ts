// Who sees Automations (liveworkspace/docs/specs/018-automations/automations.md "Who may do what"): an Editor of the
// whole item, on an item saved to an account, signed in. A Participant, a Viewer, a link confined to one tab and an
// embed see no row and no Run Rule; the api refuses them all the same (403 `automations_need_editor`), so this is
// presentation, never the rule. Whoever could edit the item but for where it lives or who they are still sees the
// row, which opens a gate (automationsGateFor): Sync on an item kept Offline, Sign In for a guest. Pure.

import type { AutomationsScope } from './kit';

export type AutomationsGateInput = {
  // The session's access: only 'edit' sees Automations.
  level: string;
  // Read-only for structure (a Viewer, a Participant, or a link confined to one tab).
  structureReadOnly: boolean;
  // An item saved only in this browser: no alarm to run rules on.
  offline: boolean;
  hydrated: boolean;
  embed: boolean;
  // Whether the reader has an account (the api's gate needs one), and whether sign-in has answered yet.
  signedIn: boolean;
  authLoaded: boolean;
  // The reader's account id, when the app knows it: with the level, who the scope is asked as.
  viewer?: string | null;
  scope: {
    ownerId: string;
    itemId: string;
    shareCode: string | null;
    tabId: string | null;
  } | null;
};

const canEditWhole = (input: AutomationsGateInput) =>
  input.hydrated &&
  !input.embed &&
  !input.structureReadOnly &&
  input.level === 'edit' &&
  (input.scope === null || input.scope.tabId === null);

/** The screen's scope: a signed-in Editor of the whole item saved to an account. */
export function automationsScopeFor(input: AutomationsGateInput): AutomationsScope | null {
  const { scope } = input;
  if (!scope || input.offline || !input.signedIn || !canEditWhole(input)) return null;
  return {
    ownerId: scope.ownerId,
    itemId: scope.itemId,
    shareCode: scope.shareCode,
    as: `${input.viewer ?? ''}:${input.level}`,
  };
}

/** What stands before the screen for someone who could edit the item: Sign In for a guest (once sign-in has
 *  answered), then Sync on an item kept Offline, else nothing. */
export type AutomationsGateKind = 'sync' | 'sign_in';
export function automationsGateFor(input: AutomationsGateInput): AutomationsGateKind | null {
  if (!canEditWhole(input)) return null;
  // Sign In comes first, as the Tools badges read; then Sync.
  if ((input.scope || input.offline) && input.authLoaded && !input.signedIn) return 'sign_in';
  if (input.offline) return 'sync';
  return null;
}

// The query that opens the screen on arrival: where a guest's sign-in comes back to.
export const AUTOMATIONS_PARAM = 'automations';
