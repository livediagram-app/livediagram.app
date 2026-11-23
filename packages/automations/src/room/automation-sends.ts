// A run's messages sent through the item's connections (liveworkspace/docs/specs/018-automations/automations.md
// "Connections", "Steps every app has"; liveworkspace/docs/specs/004-index/webhooks.md "Automation sends"). After a
// run's writes, every message it planned goes to the index in ONE push, each keyed `${runId}:${step}` so a retried
// run queues nothing new. Each answer settles its step's line: "Queued for Launch Channel", or the index's reason
// as it gives it. A message whose values all came out empty is never sent (the index refuses a blank one, and with
// it the whole push); the index unreachable fails every step with "Couldn't reach webhooks: try again". A test run
// sends nothing and says what it would post.
//
// With Pro on (liveworkspace/docs/specs/019-subscription/subscription.md "Tiers and limits") each message spends one
// of the item's owner's Automation Runs before it is pushed, beside the run's own. The index is asked first (nothing
// queued), so a paused, full or deleted connection and an index out of reach cost the owner nothing. A message the
// month has no run left for is held back: its line says why and the run is Skipped, never Failed (nothing is wrong
// with the rule). Where the service refuses the request itself, or cannot be reached, the messages go, uncounted.
import { refusedByService, type SpendResult } from '@liveworkspace/subscription';
import type { AutomationLines } from '../types';

// A message a run planned: the step that sends it, the line that says how it went, the connection and the words.
export type PlannedSend = {
  step: number;
  line: number;
  webhook: string;
  name?: string;
  text: string;
};

// One message as the client is handed it. `Subject`: what the run is about, as the app's sends say it.
export type AutomationMessage<Subject> = {
  // Made from the run and the step: the same key again queues nothing new.
  key: string;
  webhookId: string;
  // The rule's name.
  rule: string;
  subject: Subject | null;
  text: string;
  at: number;
};

// One message's answer: queued, or refused with words for the Audit Trail and why (`webhook_full` is no fault of
// the connection itself).
export type AutomationMessageResult =
  { key: string; queued: true } | { key: string; queued: false; reason: string; code: string };

// What sends the messages: the index's app client behind the app's own adapter, or a test's.
export interface AutomationSendsClient<Subject> {
  // `check`: only ask what each would get now, with nothing queued (the spend asks it first).
  push(
    itemId: string,
    messages: AutomationMessage<Subject>[],
    opts?: { check?: boolean },
  ): Promise<AutomationMessageResult[]>;
}

export const SENDS_UNREACHABLE = "Couldn't reach webhooks: try again";
export const SEND_EMPTY = 'The message came out empty';
// A message after an AI step that failed: the run stopped there.
export const SEND_NOT_SENT = 'Not sent: a step before it failed';
// The owner's month of runs has none left for it (Pro on only): not sent, and no failure of the rule's.
export const MESSAGE_RUNS_USED = 'Not sent: this month’s automation runs are used';

export type SendsOutcome = {
  // The first refusal, for the run's reason; absent when every message was queued.
  failed?: string;
  // The connection behind it, when it is paused or gone (a rule paused on it offers a fix).
  webhook?: string;
  // Why a message was held back with nothing wrong with the rule (the owner's month of runs): the run is Skipped
  // with it once the rest is done, and the rule's failures are untouched.
  skipped?: string;
};

// The owner's Automation Runs for `n` messages (the room's ItemTier spend); null where nothing is metered.
export type SpendDeliveries = (n: number) => Promise<SpendResult | null>;

// How many of `n` messages the owner's month has a run for, and why not the rest. The service spends all or
// nothing, so a refusal that leaves some is asked once more for those: two calls a run at most. A request the
// service refused (never the owner's month) sends them all, as a run goes ahead uncounted.
export async function deliveriesFor(
  spend: SpendDeliveries,
  n: number,
): Promise<{ granted: number; why?: string }> {
  const first = await spend(n);
  if (!first || first.ok || refusedByService(first)) return { granted: n };
  const why = MESSAGE_RUNS_USED;
  // Refused at a limit, by the service itself (the client's own answers never refuse one): what is left of it.
  const left = Math.min(n - 1, Math.max(0, first.limit! - first.used));
  if (left === 0) return { granted: 0, why };
  const again = await spend(left);
  return { granted: !again || again.ok ? left : 0, why };
}

const where = (s: PlannedSend) => s.name ?? 'the webhook';

/** The messages to send once the run's AI steps are done: every one, or with `failedStep` (the AI step that failed)
 *  only those of the steps before it, each later one's line in `lines` settled as not sent. */
export function heldSends<Send extends PlannedSend>(
  sends: readonly Send[],
  failedStep: number | undefined,
  lines: AutomationLines,
  offset: number,
): readonly Send[] {
  if (failedStep === undefined) return sends;
  return sends.filter((s) => {
    if (s.step < failedStep) return true;
    lines[offset + s.line] = { kind: 'action', ok: false, text: SEND_NOT_SENT };
    return false;
  });
}

// The run's messages: sent (`dry`: only said), each step's line in `lines` (at `offset + s.line`) settled.
export async function sendMessages<Subject>(
  input: {
    // Null where the room has no index to send through.
    client: AutomationSendsClient<Subject> | null;
    itemId: string;
    runId: string;
    rule: string;
    // Null for a run about the item alone.
    subject: Subject | null;
    at: number;
    dry?: boolean;
    // With Pro on, the owner's Automation Runs, one spent for each message before it is pushed.
    spend?: SpendDeliveries;
  },
  sends: readonly PlannedSend[],
  lines: AutomationLines,
  offset: number,
): Promise<SendsOutcome> {
  if (sends.length === 0) return {};
  const out: SendsOutcome = {};
  const settle = (s: PlannedSend, ok: boolean, text: string, webhook?: string) => {
    lines[offset + s.line] = { kind: 'action', ok, text };
    if (!ok && out.failed === undefined) {
      out.failed = text;
      if (webhook) out.webhook = webhook;
    }
  };
  if (input.dry) {
    for (const s of sends) settle(s, true, `Would post to ${where(s)}: ${s.text}`);
    return {};
  }
  const filled: PlannedSend[] = [];
  for (const s of sends) {
    if (s.text.trim() === '') settle(s, false, SEND_EMPTY);
    else filled.push(s);
  }
  const key = (s: PlannedSend) => `${input.runId}:${s.step}`;
  // The messages as the index takes them, pushed (or with `check`, only asked about); null when it can't be reached.
  const push = async (list: readonly PlannedSend[], check: boolean) => {
    try {
      if (!input.client) return null;
      const wire = list.map((s) => ({
        key: key(s),
        webhookId: s.webhook,
        rule: input.rule,
        subject: input.subject,
        text: s.text,
        at: input.at,
      }));
      const answer = await (check
        ? input.client.push(input.itemId, wire, { check: true })
        : input.client.push(input.itemId, wire));
      return new Map(answer.map((r) => [r.key, r]));
    } catch (error) {
      console.warn('[automations] sends.failed', { error: String(error) });
      return null;
    }
  };
  const refusedBy = (s: PlannedSend, r: AutomationMessageResult | undefined): boolean => {
    if (r?.queued) return false;
    if (!r) settle(s, false, SENDS_UNREACHABLE);
    else settle(s, false, r.reason, r.code === 'webhook_full' ? undefined : s.webhook);
    return true;
  };
  let sendable = filled;
  if (input.spend && filled.length > 0) {
    // A run is spent only for a message the index will take. A connection that pauses between this and the push
    // below loses its one run: the service gives none back.
    const would = await push(filled, true);
    sendable = filled.filter((s) => !refusedBy(s, would?.get(key(s))));
    if (sendable.length === 0) return out;
    const paid = await deliveriesFor(input.spend, sendable.length);
    if (paid.why !== undefined) {
      for (const s of sendable.slice(paid.granted))
        lines[offset + s.line] = { kind: 'action', ok: false, text: paid.why };
      out.skipped = paid.why;
      console.info('[automations] sends.unpaid', { held: sendable.length - paid.granted });
      sendable = sendable.slice(0, paid.granted);
    }
  }
  if (sendable.length === 0) return out;
  const results = await push(sendable, false);
  for (const s of sendable)
    if (!refusedBy(s, results?.get(key(s)))) settle(s, true, `Queued for ${where(s)}`);
  console.info('[automations] sends', { sent: sendable.length, failed: out.failed !== undefined });
  return out;
}
