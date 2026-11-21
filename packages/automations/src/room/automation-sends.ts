// A run's messages sent through the item's connections (liveworkspace/docs/specs/018-automations/automations.md
// "Connections", "Steps every app has"; liveworkspace/docs/specs/004-index/webhooks.md "Automation sends"). After a
// run's writes, every message it planned goes to the index in ONE push, each keyed `${runId}:${step}` so a retried
// run queues nothing new. Each answer settles its step's line: "Queued for Launch Channel", or the index's reason
// as it gives it. A message whose values all came out empty is never sent (the index refuses a blank one, and with
// it the whole push); the index unreachable fails every step with "Couldn't reach webhooks: try again". A test run
// sends nothing and says what it would post.
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
  push(itemId: string, messages: AutomationMessage<Subject>[]): Promise<AutomationMessageResult[]>;
}

export const SENDS_UNREACHABLE = "Couldn't reach webhooks: try again";
export const SEND_EMPTY = 'The message came out empty';
// A message after an AI step that failed: the run stopped there.
export const SEND_NOT_SENT = 'Not sent: a step before it failed';

export type SendsOutcome = {
  // The first refusal, for the run's reason; absent when every message was queued.
  failed?: string;
  // The connection behind it, when it is paused or gone (a rule paused on it offers a fix).
  webhook?: string;
};

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
  const sendable: PlannedSend[] = [];
  for (const s of sends) {
    if (s.text.trim() === '') settle(s, false, SEND_EMPTY);
    else sendable.push(s);
  }
  if (sendable.length === 0) return out;
  const key = (s: PlannedSend) => `${input.runId}:${s.step}`;
  let results: AutomationMessageResult[] | null = null;
  try {
    if (input.client)
      results = await input.client.push(
        input.itemId,
        sendable.map((s) => ({
          key: key(s),
          webhookId: s.webhook,
          rule: input.rule,
          subject: input.subject,
          text: s.text,
          at: input.at,
        })),
      );
  } catch (error) {
    console.warn('[automations] sends.failed', { error: String(error) });
  }
  const byKey = new Map((results ?? []).map((r) => [r.key, r]));
  for (const s of sendable) {
    const r = byKey.get(key(s));
    if (!r) settle(s, false, SENDS_UNREACHABLE);
    else if (r.queued) settle(s, true, `Queued for ${where(s)}`);
    else settle(s, false, r.reason, r.code === 'webhook_full' ? undefined : s.webhook);
  }
  console.info('[automations] sends', { sent: sendable.length, failed: out.failed !== undefined });
  return out;
}
