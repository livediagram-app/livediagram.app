// /api/documents/<id>/automations[/…]: the knowledgebase's rules (docs/specs/013-workspace/automations.md "Share
// roles"; blueprint automations.md "Routes"). The routes themselves are the engine's (@liveworkspace/automations/room:
// the list, a rule's save, toggle, duplicate, run, secret, the order, Test Rule, Describe a Rule, the Audit Trail and
// a rule's summary); this file names the path and says who is calling, by the knowledgebase's own gates:
//
//   - an Editor of the whole knowledgebase (the person's own role, with no tab, so a link to one page is refused, and
//     never a workbench embed); a Participant, an Editor minus the settings, the style and automations, is not;
//   - signed in, in person or through their API token (a guest is not);
//   - a token, and whether it only reads: a token below the `write` scope here reads the rules and changes none
//     (knowledge/agent-grants.ts turns the engine's `read_only_token` into `scope_needed` for it);
//   - a reader: anyone holding a grant on the knowledgebase, for a rule's summary.
//
// Anyone but a signed-in Editor of the whole knowledgebase is answered 403 `automations_need_editor` by the engine.
// Runs inside the knowledgebase's Durable Object, where the rules are.
import {
  itemAutomationPath,
  itemCallerOf,
  serveItemAutomations,
} from '@liveworkspace/automations/room';
import { getDocument } from '../db';
import { applyingAi, askerOf, keyAnswerOf } from '../knowledge/ai-settings';
import { authorOf } from './changesets';
import { grantOn, missingDocument, type DocumentRouteContext } from './context';

export async function handleAutomationRoutes(ctx: DocumentRouteContext): Promise<Response | null> {
  const { request, env, segments } = ctx;
  if (segments[3] !== 'automations' || segments.length > 6) return null;
  // The path after `…/automations` when it is a shape the engine serves, so any other touches nothing.
  const rest = itemAutomationPath([segments[4], segments[5]]);
  if (!rest) return null;
  const id = segments[2]!;
  const existing = await getDocument(env, id);
  if (!existing) return missingDocument(ctx, id);
  return serveItemAutomations({
    engine: env.AUTOMATIONS,
    request,
    url: ctx.url,
    rest,
    caller: async () => {
      const owner = ctx.resolveOwner();
      const access = grantOn(ctx, id);
      return itemCallerOf({
        // The person's own role: a token's scopes decide what it may change, below.
        editor:
          !ctx.workbench &&
          access !== null &&
          access.personRole === 'edit' &&
          access.tabScope === null,
        // An account, in person or behind a token: a guest's id is never one.
        signedIn: ctx.verifiedUserId !== null && !ctx.workbench,
        token: ctx.token && {
          readOnly: ctx.token.readOnly === true || !(access?.scopes ?? []).includes('write'),
        },
        callerId: owner,
        // Only someone the gate lets through is named: their rules and runs carry their name.
        person: () => authorOf(ctx, owner!),
        reader: grantOn(ctx, id) !== null,
        // Describe a Rule on the knowledgebase's own key, its team's or the caller's (search-and-ask.md "Which key
        // answers").
        aiKey: async () => keyAnswerOf(await applyingAi(env, id, askerOf(ctx, existing.teamId))),
      });
    },
  });
}
