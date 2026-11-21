// /api/documents/<id>/automations[/…]: the document's rules (docs/specs/013-workspace/automations.md "Share roles";
// blueprint automations.md "Routes"). The routes themselves are the engine's (@liveworkspace/automations/room: the
// list, a rule's save, toggle, duplicate, run, secret, the order, Test Rule, Describe a Rule, the Audit Trail and a
// rule's summary); this file names the path and says who is calling, by the document's own gates:
//
//   - an Editor of the whole document (gateEdit with no tab, so a link to one tab is refused; never a workbench embed);
//   - signed in, in person or through their API token (a guest is not);
//   - a token, and whether it only reads;
//   - a reader: anyone holding a grant on the document, for a rule's summary.
//
// Anyone but a signed-in Editor of the whole document is answered 403 `automations_need_editor` by the engine. Runs
// inside the document's Durable Object, where the rules are.
import {
  itemAutomationPath,
  itemCallerOf,
  serveItemAutomations,
} from '@liveworkspace/automations/room';
import { getDocument } from '../db';
import { authorOf } from './changesets';
import { gateEdit, grantOn, missingDocument, type DocumentRouteContext } from './context';

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
      return itemCallerOf({
        editor: !ctx.workbench && (await gateEdit(ctx, id)),
        // An account, in person or behind a token: a guest's id is never one.
        signedIn: ctx.verifiedUserId !== null && !ctx.workbench,
        token: ctx.token,
        callerId: owner,
        // Only someone the gate lets through is named: their rules and runs carry their name.
        person: () => authorOf(ctx, owner!),
        reader: grantOn(ctx, id) !== null,
      });
    },
  });
}
