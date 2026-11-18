// Matching an agent's import's people to the plan's team by email (docs/specs/026-plan/tracker-import.md "Agents",
// blueprint tracker-import.md "Matching people by email"): `POST /api/projects/:id/items/import/people`. The editor
// reads the team's people itself (routes/teams.ts, never for an API token); an agent sends the file's emails and is
// answered, for each, the team member it belongs to or null, so no email ever leaves the api. Only a joined member of
// the plan's team is answered matches: a member can already see the team's people, and anyone else (a share link's
// Editor, someone outside the team) is answered null for every email, so it can't tell a member's email from a
// stranger's.

import type { ItemsImportPeople } from '@liveplanner/api-schema';
import {
  TRACKER_EMAIL_MAX,
  TRACKER_MATCH_EMAILS_MAX,
  teamMemberPersonOf,
  type ItemPerson,
} from '@liveplanner/items';
import { presenceColourOf } from '@liveworkspace/settings/presence';
import { teamPeople } from '../person/notify';
import { badRequest, forbidden, json } from '../responses';
import { readBody, type PlanRouteContext } from './context';
import { itemCaller } from './item-route-kit';

// The emails asked, or why the body is not a match request.
function readEmails(body: Record<string, unknown>): string[] | string {
  const { emails } = body;
  if (
    !Array.isArray(emails) ||
    emails.length < 1 ||
    emails.length > TRACKER_MATCH_EMAILS_MAX ||
    !emails.every((e) => typeof e === 'string' && e.length <= TRACKER_EMAIL_MAX)
  )
    return `emails must be 1 to ${TRACKER_MATCH_EMAILS_MAX} strings of at most ${TRACKER_EMAIL_MAX} characters`;
  return emails as string[];
}

// The plan's team's joined members by email (lower-cased), when `owner` is one of them; null otherwise (no team, a
// caller outside it, or a team accounts can't read). Membership is read from accounts' people of the team, not the
// token's claim, so someone who left the team is not answered.
async function membersFor(
  ctx: PlanRouteContext,
  owner: string,
  teamId: string | null,
): Promise<Map<string, ItemPerson> | null> {
  if (!teamId) return null;
  const people = await teamPeople(ctx.env, teamId);
  if (!people?.some((p) => p.status === 'joined' && p.userId === owner)) return null;
  const byEmail = new Map<string, ItemPerson>();
  for (const p of people) {
    const person = await teamMemberPersonOf(p, (name) => presenceColourOf(name, p.color));
    if (person) byEmail.set(p.email.trim().toLowerCase(), person);
  }
  return byEmail;
}

export async function importPeople(ctx: PlanRouteContext, projectId: string): Promise<Response> {
  // The import's own gate: edit on the whole plan (item-import-route.ts).
  const caller = await itemCaller(ctx, projectId, 'edit');
  if (caller instanceof Response) return caller;
  if (caller.scope) return forbidden();
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const emails = readEmails(body);
  if (typeof emails === 'string') return badRequest(emails);
  const members = await membersFor(ctx, caller.owner, caller.doc?.teamId ?? null);
  const people = emails.map((e) => members?.get(e.trim().toLowerCase()) ?? null);
  // Counts only: never an email, in a log line or an answer.
  console.info('[items] import.people', {
    projectId,
    asked: emails.length,
    member: members !== null,
    matched: people.filter(Boolean).length,
  });
  const answer: ItemsImportPeople = { people };
  return json(answer);
}
