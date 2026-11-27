// A chat request run as the linked person (docs/specs/030-knowledgebase/chat-apps.md "Whose access an answer uses"):
// the index's grant for that account on the knowledgebase, asked with this app's key as the person, and the request
// handed to the knowledgebase's room with that grant and no bearer. So a chat answer reads exactly what the person
// reads in the editor, through the same gates, and on the knowledgebase's own AI key or built-in AI (no bearer: the
// person's own key in liveworkspace is never spent from chat). Nobody linked, nothing is asked.
import { accountsTeamReader, createTeamAccess } from '@liveworkspace/index-app';
import { accountCredentials } from '../auth/accounts';
import { documentRoom } from '../document-client';
import { documentGrantOf, indexService, requestGrant, type DocumentGrant } from '../index-service';
import type { Env } from '../types';

const teamAccess = createTeamAccess();

/** What a chat request runs on: the grant and the room. The tests hand in their own index and rooms. */
export type ChatPersonDeps = {
  grantFor: (env: Env, knowledgebase: string, person: string) => Promise<DocumentGrant | null>;
  route: (
    env: Env,
    knowledgebase: string,
    request: Request,
    person: string,
    grant: DocumentGrant,
  ) => Promise<Response>;
};

async function grantFor(env: Env, knowledgebase: string, person: string) {
  let teams: string[] = [];
  try {
    teams = (
      await teamAccess.currentTeams(accountsTeamReader(accountCredentials(env)), person, null)
    ).map((t) => t.id);
  } catch (error) {
    console.warn('[chat] teams unread', { error: String(error) });
  }
  const outcome = await requestGrant(
    env,
    { kind: 'delegate', personId: person, teams },
    knowledgebase,
    null,
  );
  if (!outcome.ok || outcome.grant.trashed) return null;
  const claims = await indexService.verifyGrant(env, outcome.grant.grant, knowledgebase);
  return claims ? documentGrantOf(claims, null, outcome.grant.grant) : null;
}

export const chatPersonDeps: ChatPersonDeps = {
  grantFor,
  route: (env, knowledgebase, request, person, grant) =>
    documentRoom(env, knowledgebase).route(request, {
      accountUserId: person,
      verifiedUserId: person,
      accountEmail: null,
      owner: person,
      token: null,
      workbench: null,
      teams: null,
      bearer: null,
      grant,
    }),
};

/** The answer to `method path` on the knowledgebase as `person`: 403 `no_access` when the index grants them nothing. */
export async function callAsPerson(
  env: Env,
  deps: ChatPersonDeps,
  call: { knowledgebase: string; person: string; method: string; path: string; body?: unknown },
): Promise<Response> {
  const grant = await deps.grantFor(env, call.knowledgebase, call.person);
  if (!grant || grant.item !== call.knowledgebase)
    return Response.json({ error: 'no_access' }, { status: 403 });
  const request = new Request(`https://chat.internal${call.path}`, {
    method: call.method,
    headers: { 'Content-Type': 'application/json' },
    ...(call.body === undefined ? {} : { body: JSON.stringify(call.body) }),
  });
  return deps.route(env, call.knowledgebase, request, call.person, grant);
}
