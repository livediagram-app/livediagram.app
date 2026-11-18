// Who sees Email to Board (docs/specs/026-plan/email-to-board.md "Who may manage an address"): an Editor of the whole
// plan (its owner, a team member, an Editor link with no tab), in person, on a plan saved to the server, outside an
// embed and a workbench frame, signed in (an address is an account's). A guest Editor, and one on a plan in This
// Browser, sees the row badged and gated (emailIntakeGateFor); a Participant, a Viewer and a link to one tab see no
// row. The api refuses them all the same (403 `email_intake_needs_editor`), so this is presentation, never the rule.
// Pure.
import type { AccessLevel } from '@liveplanner/api-schema';

/** Who is asking, about which plan: an Editor link's code rides along. */
export type EmailIntakeScope = { ownerId: string; projectId: string; shareCode: string | null };

type GateInput = {
  level: AccessLevel;
  // An address is an account's: a guest signs in first (and whether sign-in has answered yet).
  signedIn: boolean;
  authLoaded: boolean;
  hydrated: boolean;
  embed: boolean;
  workbench: boolean;
  // A plan saved only in this browser: no server to take its mail.
  offline: boolean;
  scope: {
    ownerId: string;
    projectId: string;
    shareCode: string | null;
    tabId: string | null;
  } | null;
};

export function emailIntakeScopeFor(input: GateInput): EmailIntakeScope | null {
  const { scope } = input;
  if (!scope || !input.hydrated || input.embed || input.workbench || input.offline) return null;
  if (!input.signedIn || input.level !== 'edit' || scope.tabId !== null) return null;
  return { ownerId: scope.ownerId, projectId: scope.projectId, shareCode: scope.shareCode };
}

/** What stands before Email to Board for an Editor of the whole plan (liveworkspace/docs/specs/004-index/
 *  footer-tools-menu.md "Always there"): Sign In for a guest (once sign-in has answered), then Sync Plan on a plan in
 *  This Browser; null for anyone else, and for one who may already manage an address. */
export function emailIntakeGateFor(input: GateInput): 'sync' | 'sign_in' | null {
  const { scope } = input;
  if (!input.hydrated || input.embed || input.workbench) return null;
  if (input.level !== 'edit' || (scope && scope.tabId !== null)) return null;
  if (!scope && !input.offline) return null;
  if (!input.signedIn) return input.authLoaded ? 'sign_in' : null;
  return input.offline ? 'sync' : null;
}

// The query that opens Email to Board on arrival: where a guest's sign-in comes back to.
export const EMAIL_INTAKE_PARAM = 'email';
