// livedocuments' own triggers' moments, queued where they happen (docs/specs/013-workspace/automations.md "Triggers
// of its own"; blueprint automations.md "Event call sites"): Version Named, Version Restored and Agent Made Changes.
// Each through the platform's queueEvent, which does nothing but one Set lookup unless a rule that is on hears the
// kind. Who did it is a person (an Editor), an agent (an API token, by its name) or a rule's own step (its `source`,
// so the chain rules decide whether it starts another rule).
import {
  AGENT_CHANGED_EVENT,
  VERSION_NAME_DATA,
  VERSION_NAMED_EVENT,
  VERSION_RESTORED_EVENT,
} from '@livedocuments/document/automations';
import type { AutomationPerson } from '@liveworkspace/automations';
import type { ItemRole } from '@liveworkspace/automations/item';
import {
  automationAuthor,
  queueEvent,
  writerOf,
  type ItemActionContext,
  type ItemHost,
} from '@liveworkspace/automations/room';

type Host = Pick<ItemHost, 'AUTOMATIONS'>;

// Whoever a version event names.
export type VersionWho = { by: AutomationPerson; role: ItemRole; rule?: string; chain?: number };

/** A person's or an agent's write: an agent by its token's name. `token`: the API token that wrote, null for a
 *  person. */
export const personWho = (
  author: AutomationPerson,
  token: { name?: string | null } | null,
): VersionWho => writerOf(author, token);

/** A rule's own step: Automation, with the rule's name, tagged with the run's source. */
export const ruleWho = (ctx: Pick<ItemActionContext, 'rule' | 'source'>): VersionWho => ({
  by: automationAuthor(ctx),
  ...ctx.source,
});

/** Whether a rule that is on hears `kind`, for a call site that must read something to say who. */
export const hearsVersion = (host: Host, kind: string): boolean =>
  host.AUTOMATIONS?.kinds.has(kind) === true;

/** A tab's version named (`named`) or the tab restored to one (`restored`). `name`: the version's name ('' for an
 *  unnamed one). */
export function queueVersionEvent(
  host: Host,
  kind: 'named' | 'restored',
  input: { tab: string; version: string; name: string | null; who: VersionWho },
): void {
  const at = Date.now();
  queueEvent(host, {
    id: `version_${kind}:${input.version}:${at}`,
    kind: kind === 'named' ? VERSION_NAMED_EVENT : VERSION_RESTORED_EVENT,
    at,
    tab: input.tab,
    ...input.who,
    data: { [VERSION_NAME_DATA]: input.name ?? '' },
  });
}

/** Agent Made Changes: once per write a token made, `key` naming that write. */
export function queueAgentChanged(
  host: Host,
  input: { key: string; tab: string; author: AutomationPerson; tokenName?: string | null },
): void {
  queueEvent(host, {
    id: `agent:${input.key}`,
    kind: AGENT_CHANGED_EVENT,
    at: Date.now(),
    tab: input.tab,
    ...writerOf(input.author, { name: input.tokenName ?? null }),
  });
}
