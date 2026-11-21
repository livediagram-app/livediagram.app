// Component Changed, queued where a main changes (docs/specs/013-workspace/automations.md "Triggers of its own";
// blueprint automations.md "Event call sites"): a person's or an agent's stored write to the library through the
// component routes (routes/component-routes.ts), the one path a main is made or changed by. A rule's own settle
// (@livedesign/design/automations COMPONENT_QUIET_MS) makes a burst of them one run. A token's write is also Agent
// Made Changes, once per write. A revert's library, a copy's and a shared tab's taken in are none: they put back or
// bring in, never change. Nothing is read, built or written unless a rule that is on hears the kind: each check is
// one Set lookup.
import {
  COMPONENT_CHANGED_EVENT,
  COMPONENT_ID_DATA,
  COMPONENT_NAME_DATA,
} from '@livedesign/design/automations';
import type { DesignComponent } from '@livedesign/design';
import { AGENT_CHANGED_EVENT, type ItemEvent } from '@liveworkspace/automations/item';
import {
  hearsEvent,
  queueAgentChanged,
  queueEvent,
  writerOf,
} from '@liveworkspace/automations/room';
import type { AutomationPerson } from '@liveworkspace/automations';
import type { DesignEnv } from '../../types';

// The write as its route knows it: the main as stored, whoever wrote it, and the token they wrote through.
export type ComponentWrite = {
  main: Pick<DesignComponent, 'id' | 'name' | 'updatedAt'>;
  author: () => Promise<AutomationPerson>;
  token: { name?: string | null } | null;
};

/** The events a stored write to a main makes, for the rules that hear them. */
export async function queueComponentChanged(env: DesignEnv, write: ComponentWrite): Promise<void> {
  const change = hearsEvent(env, COMPONENT_CHANGED_EVENT);
  const agent = write.token !== null && hearsEvent(env, AGENT_CHANGED_EVENT);
  if (!change && !agent) return;
  const author = await write.author();
  // One write, one key: the main and the time it was stored at (every stored write moves `updatedAt`).
  const key = `component:${write.main.id}:${write.main.updatedAt}`;
  if (change) {
    const event: ItemEvent = {
      id: key,
      kind: COMPONENT_CHANGED_EVENT,
      at: Date.now(),
      ...writerOf(author, write.token),
      data: { [COMPONENT_ID_DATA]: write.main.id, [COMPONENT_NAME_DATA]: write.main.name },
    };
    queueEvent(env, event);
  }
  if (agent) queueAgentChanged(env, { key, author, tokenName: write.token?.name ?? null });
}
