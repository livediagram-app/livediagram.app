// Who a request's knowledge change is by, as a rule reads it (docs/specs/013-workspace/automations.md "Triggers of
// its own"): the caller as a person, by their name and colour, or an agent by its token's name. Asked only when a
// rule hears the change (knowledge-events.ts), so a save no rule hears looks nobody up.
import { SOMEONE, writerOf } from '@liveworkspace/automations/room';
import { accountOf } from '../../knowledge/knowledge-caller';
import { getParticipant } from '../../person/profiles';
import type { DocumentRouteContext } from '../../routes/context';
import type { KnowledgeWho } from './knowledge-events';

export async function routeWho(ctx: DocumentRouteContext): Promise<KnowledgeWho> {
  const account = accountOf(ctx);
  const person = account ? await getParticipant(ctx.env, account) : null;
  const author = {
    id: account ?? '',
    name: person?.name || (account ? SOMEONE.name : 'Guest'),
    color: person?.color || SOMEONE.color,
  };
  return writerOf(author, ctx.token ? { name: ctx.token.name ?? null } : null);
}
