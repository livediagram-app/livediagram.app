// The triggers waiting for a plan's alarm (docs/specs/026-plan/automations.md "Runs, limits and loops"; blueprint
// automations.md "The event"). A landed card write's events go into `automation_queue` in the same batch as its
// history entry (db/item-history.ts), a new comment's on its own (the thread routes), and only for the kinds some rule
// that is on hears: a plan with none builds no event and runs no statement. At most AUTOMATION_QUEUE_MAX wait; a
// burst past it drops the newest, which the next wake logs once. The wake the queue asks for (`AutomationSchedule`, as
// RepeatSchedule is the repeats') and the room's holder are @liveworkspace/automations/room's
// (liveworkspace/docs/specs/018-automations/blueprints/engine.md "The room entry"); `PlanAutomations` is that holder
// over a plan's rules, what the room puts on its env for the writes and routes.
import {
  AUTOMATION_QUEUE_MAX,
  eventOfWrite,
  type AutomationEvent,
  type AutomationEventKind,
  type AutomationRole,
  type AutomationRule,
  type Item,
  type ItemHistoryChange,
  type ItemHistoryTag,
} from '@liveplanner/items';
import type { PlanEnv } from '../../types';
import type { RunnerDeps } from './automation-runner';
import {
  AutomationSchedule as Schedule,
  ItemAutomations,
  type AutomationsHook as Hook,
} from '@liveworkspace/automations/room';
import { PLAN_RULES, type Sql } from './automation-store';

// The wake a plan's queue asks for, over its events.
export type AutomationSchedule = Schedule<AutomationEvent>;

// Who made a write and why, as the write's caller knows it. `role` may be worked out only when an event is built
// (an Editor check the caller would otherwise not make); absent, the history tag says.
export type HistorySource = {
  role?: AutomationRole | (() => Promise<AutomationRole>);
  // The rule that made the change, and the chain so far (its run's).
  rule?: string;
  chain?: number;
  // The Form tab whose response made the card, and that response's answers as text by question.
  form?: string;
  answers?: Record<string, string>;
  // An email that made the card (Email to Board): its sender and the board whose address took it.
  email?: { from: string; board: string };
  // A run a GitHub trigger started: its card writes are tagged 'automation_github' (drawn as GitHub's).
  via?: 'github';
};

// What a plan's writes ask of its Automations: the kinds its rules hear (the hot-path check), and a wake once
// events are queued (with how many the queue had no room for).
export type AutomationsHook = Hook<AutomationEventKind>;

// A write's role when its caller named none: from the history tag.
export function roleOfTag(tag: ItemHistoryTag | undefined): AutomationRole {
  if (tag === 'ai') return 'agent';
  if (tag === 'automation' || tag === 'automation_github') return 'automation';
  return tag === 'form' || tag === 'repeat' ? 'system' : 'editor';
}

// The events the landed writes make that some rule hears, their role settled once. Called only when `kinds` holds
// a kind.
export async function eventsOfWrites(
  kinds: ReadonlySet<AutomationEventKind>,
  writes: readonly { before: Item | null; after: Item; changes: readonly ItemHistoryChange[] }[],
  tag: ItemHistoryTag | undefined,
  source: HistorySource = {},
): Promise<AutomationEvent[]> {
  const out: AutomationEvent[] = [];
  const base = {
    role: 'editor' as AutomationRole,
    ...(source.rule !== undefined ? { rule: source.rule, chain: source.chain ?? 0 } : {}),
    ...(source.form !== undefined ? { form: source.form } : {}),
    ...(source.answers !== undefined ? { answers: source.answers } : {}),
    ...(source.email !== undefined ? { email: source.email } : {}),
  };
  for (const w of writes) {
    // A card put back (an undo of its delete, a redo of its making, an offline plan's sync) is no new card: its
    // create starts nothing (spec "Triggers").
    if (!w.before && tag === 'undo') continue;
    const event = eventOfWrite(w.before, w.after, w.changes, base);
    if (event && kinds.has(event.kind)) out.push(event);
  }
  if (out.length === 0) return out;
  const role =
    typeof source.role === 'function' ? await source.role() : (source.role ?? roleOfTag(tag));
  for (const e of out) e.role = role;
  return out;
}

// The insert of `events`, as many as the queue has room for: its `meta.changes` says how many went in.
export function enqueueStatement(
  db: D1Database,
  events: readonly AutomationEvent[],
  now: number,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO automation_queue (event, at) SELECT value, ? FROM json_each(?)
        LIMIT MAX(0, ? - (SELECT COUNT(*) FROM automation_queue))`,
    )
    .bind(now, JSON.stringify(events.map((e) => JSON.stringify(e))), AUTOMATION_QUEUE_MAX);
}

// A comment's event (or a resolve's that left a card no open thread), when some rule hears it: queued on its own,
// and the room asked for a wake.
export async function enqueueComment(
  env: Pick<PlanEnv, 'PLAN_DB' | 'AUTOMATIONS'>,
  event: Omit<AutomationEvent, 'kind' | 'at'>,
  kind: 'comment' | 'resolved' = 'comment',
): Promise<void> {
  const hook = env.AUTOMATIONS;
  if (!hook?.kinds.has(kind)) return;
  const now = Date.now();
  try {
    const res = await enqueueStatement(env.PLAN_DB, [{ ...event, kind, at: now }], now).run();
    hook.queued(1 - (res.meta.changes ?? 0));
  } catch (error) {
    console.warn('[automations] enqueue.failed', { error: String(error) });
  }
}

// A plan's Automations as its room holds them: the rules, the queue's wake, the hook its writes call, and what a
// run needs from the room (null while it holds no plan), for the wake and the routes alike. `putAway`: whether the
// plan is archived or in the Trash (plan-standing.ts): its schedule reads as empty and it hears nothing.
export class PlanAutomations extends ItemAutomations<
  AutomationRule,
  AutomationEventKind,
  AutomationEvent,
  RunnerDeps
> {
  constructor(
    sql: () => Sql,
    ready: () => boolean,
    arm: () => void,
    deps: () => RunnerDeps | null,
    putAway: () => boolean = () => false,
  ) {
    super({ sql, ready, arm, deps, putAway, kit: PLAN_RULES });
  }
}
