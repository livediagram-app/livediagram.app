// The Knowledgebase Reviews emails an Editor or a Participant asks for (docs/specs/030-knowledgebase/ai-knowledge.md "Pages that
// disagree", "Knowledge Health"):
//   POST /api/documents/<id>/conflicts/<id>/ask-owners   Ask Both Owners: each owner of the two pages, once a conflict
//   POST /api/documents/<id>/knowledge/remind-owners     Remind the Owners: each owner's pages, once a week
// A signed-in Editor's or Participant's, in person (ai-knowledge.md "Share roles"): an agent does not write to people, and neither does a guest. Each answers 200 with what was sent or why nothing was
// (`KnowledgeEmailResult`); the caps and the sending are knowledge/knowledge-emails.ts.
import type { KnowledgeEmailResult } from '@liveknowledge/api-schema';
import { askConflictOwners, remindOwners } from '../knowledge/knowledge-emails';
import { forbidden, json, methodNotAllowed } from '../responses';
import { openConflicts } from './knowledge-overview-routes';
import type { KnowledgeRoute } from './knowledge-routes';
import { writesPages } from './context';

/** Null when the path is neither route. */
export async function handleEmailRoutes(route: KnowledgeRoute): Promise<Response | null> {
  const { ctx, document, grant } = route;
  const { segments, request, env } = ctx;
  const remind =
    segments[3] === 'knowledge' && segments.length === 5 && segments[4] === 'remind-owners';
  const ask =
    segments[3] === 'conflicts' &&
    segments.length === 6 &&
    !!segments[4] &&
    segments[5] === 'ask-owners';
  if (!remind && !ask) return null;
  if (request.method !== 'POST') return methodNotAllowed();
  // A signed-in Editor or Participant: an email is asked for by a person the owners can name, never a token or a
  // passing guest.
  if (!writesPages(grant) || ctx.token || !ctx.accountUserId) return forbidden();
  const now = Date.now();
  let result: KnowledgeEmailResult;
  if (remind) result = await remindOwners(env, document, now);
  else {
    const conflict = (await openConflicts(env, document.knowledgeSettings.reviewEvery, now)).find(
      (c) => c.id === segments[4],
    );
    if (!conflict)
      return json(
        { error: 'conflict_unknown', message: 'This disagreement is closed or was dismissed.' },
        { status: 404 },
      );
    result = await askConflictOwners(env, document, conflict, now);
  }
  console.info('[knowledge] email asked', {
    documentId: document.id,
    kind: remind ? 'remind' : 'ask',
    outcome: result.outcome,
  });
  return json(result);
}
