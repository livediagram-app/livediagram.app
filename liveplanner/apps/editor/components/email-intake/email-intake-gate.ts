// Who sees Email to Board (docs/specs/026-plan/email-to-board.md "Who may manage an address"): an Editor of the whole
// plan (its owner, a team member, an Editor link with no tab), in person, on a plan saved to the server, outside an
// embed and a workbench frame. A guest may manage, so signing in is not asked. A Participant, a Viewer, a link to one
// tab and a plan in This Browser see no row; the api refuses them all the same (403 `email_intake_needs_editor`), so
// this is presentation, never the rule. Pure.
import type { AccessLevel } from '@liveplanner/api-schema';

/** Who is asking, about which plan: an Editor link's code rides along. */
export type EmailIntakeScope = { ownerId: string; projectId: string; shareCode: string | null };

type GateInput = {
  level: AccessLevel;
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
  if (input.level !== 'edit' || scope.tabId !== null) return null;
  return { ownerId: scope.ownerId, projectId: scope.projectId, shareCode: scope.shareCode };
}
