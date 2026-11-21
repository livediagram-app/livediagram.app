// The moments an item's rules hear, queued where they happen (liveworkspace/docs/specs/018-automations/automations.md
// "Triggers every app has"; blueprint item-engine.md "Events in", "An app's bindings"). An app's room puts its engine
// on the env its content code runs with, as `AUTOMATIONS` (and the comment triggers' watch as `COLLAB`); each call
// site hands its event here beside its own write, in the same synchronous stretch, which a Durable Object commits as
// one. Nothing is built, read or written unless a rule that is on hears the kind: the check is one Set lookup on the
// engine, absent outside an item's room.
import { AGENT_CHANGED_EVENT, type ItemEvent, type ItemRole } from '../../item';
import type { AutomationPerson } from '../../types';
import type { ItemEngine } from '../item/engine';
import { queueItemEvent } from '../item/intake';
import { keptSnapshotIds } from '../item/kept';
import { withItemWriter } from '../item/writer';
import type { CollabWatch } from './collab-watch';

// What an app's room adds to the env its content code runs with. Both absent outside a room (a test's env, a route
// probe), where nothing is heard.
export interface ItemHost {
  AUTOMATIONS?: ItemEngine;
  COLLAB?: CollabWatch;
}

type Host = Pick<ItemHost, 'AUTOMATIONS'>;

// Someone with no profile to name them.
export const SOMEONE: AutomationPerson = { id: '', name: 'Someone', color: '#94a3b8' };

/** `text` cut to `max` characters, never through the middle of one. */
export const cutTo = (text: string, max: number): string =>
  text.length <= max ? text : [...text].slice(0, max).join('');

/** Whether a rule that is on hears `kind` (none while the item is put away). */
export const hearsEvent = (host: Host, kind: string): boolean =>
  host.AUTOMATIONS?.kinds.has(kind) === true;

/** Queues `event` when a rule hears it; answers whether it went on the queue. */
export function queueEvent(host: Host, event: ItemEvent): boolean {
  const engine = host.AUTOMATIONS;
  if (!engine || !engine.kinds.has(event.kind)) return false;
  return queueItemEvent(engine.sql(), engine, event);
}

// A token with no name of its own, as a rule's run names it.
export const AGENT_NAME = 'An agent';

/** Whoever a rule's run names for a write: an agent by its token's name, a person by their own. `token`: the API
 *  token that wrote, null for a person. */
export function writerOf(
  author: AutomationPerson,
  token: { name?: string | null } | null,
): { by: AutomationPerson; role: ItemRole } {
  const { id, name, color } = author;
  return token
    ? { by: { id, name: token.name?.trim() || AGENT_NAME, color }, role: 'agent' }
    : { by: { id, name, color }, role: 'editor' };
}

/** Agent Made Changes: once per write a token made, `key` naming that write (a changeset's id), `tab` the tab it
 *  changed (none for a write about no one tab, which only a rule kept to no tab hears). Answers whether it went on
 *  the queue. */
export function queueAgentChanged(
  host: Host,
  input: { key: string; tab?: string; author: AutomationPerson; tokenName?: string | null },
): boolean {
  return queueEvent(host, {
    id: `agent:${input.key}`,
    kind: AGENT_CHANGED_EVENT,
    at: Date.now(),
    ...(input.tab !== undefined ? { tab: input.tab } : {}),
    ...writerOf(input.author, { name: input.tokenName ?? null }),
  });
}

/** A share level (`edit`, `participate`, anything else) as a rule's Who Did It reads it. */
export const roleOfLevel = (level: string | undefined): ItemRole =>
  level === 'edit' ? 'editor' : level === 'participate' ? 'participant' : 'viewer';

/** `write` (a tab added or removed) with whoever makes it, so Tab Added and Tab Removed say who. `who` is asked
 *  only when a rule hears `kind`; otherwise `write` runs alone and nothing else does. */
export async function asTabWriter<T>(
  host: Host,
  kind: 'tab_added' | 'tab_removed',
  who: () => Promise<{ by: AutomationPerson; role: ItemRole }>,
  write: () => Promise<T> | T,
): Promise<T> {
  const engine = host.AUTOMATIONS;
  if (!engine || !engine.kinds.has(kind)) return write();
  return withItemWriter(engine.sql(), { who: await who() }, write);
}

/** `write` (a revert's content replace) with nothing of it queued or counted as an edit, a rule's revert and a
 *  person's alike. `write` alone when no rule hears a tab change. */
export function silently<T>(host: Host, write: () => Promise<T>): Promise<T> {
  const engine = host.AUTOMATIONS;
  const fed = engine?.deps()?.fed() === true;
  if (!engine || !fed) return write();
  return withItemWriter(engine.sql(), { silent: true }, write);
}

/** The snapshots the item's rules name, for the snapshots door's `kept`. */
export const keptSnapshots = (host: Host): string[] =>
  host.AUTOMATIONS ? keptSnapshotIds(host.AUTOMATIONS.store) : [];
