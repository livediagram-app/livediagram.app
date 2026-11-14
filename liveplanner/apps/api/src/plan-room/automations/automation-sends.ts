// A run's outgoing actions sent (docs/specs/026-plan/automations.md "Outgoing actions"; blueprint automations.md
// "Phase 2", "Runner additions"; liveworkspace/docs/specs/004-index/webhooks.md "Automation sends"). After the card
// writes, every message the run planned goes to the index in ONE push through the plan's webhooks, with the app's
// own key (as card moves go, plan-outbox.ts), each keyed `${runId}:${step}` so a retried run queues nothing new. Each
// answer settles its step's line: "Queued for Launch Channel", or the index's reason as it gives it. A message whose
// values all came out empty is never sent (the index refuses a blank one, and with it the whole push); the index
// unreachable fails every step with "Couldn't reach webhooks: try again". Test on a Card sends nothing and says what
// it would post.
import type { AutomationStepLine, PlannedSend } from '@liveplanner/items';
import type { AutomationSendResult, IndexAppClient } from '@liveworkspace/index-client';
import { indexAppClient } from '../../index-service';
import type { PlanEnv } from '../../types';

// The index's automation sends (packages/index-client webhooks.ts). The room's client is the index's app client;
// tests hand in their own with just this method.
export type { AutomationSend, AutomationSendResult } from '@liveworkspace/index-client';
export type AutomationSendsClient = Pick<IndexAppClient, 'pushAutomationSends'>;

export const SENDS_UNREACHABLE = "Couldn't reach webhooks: try again";
export const SEND_EMPTY = 'The message came out empty';
// A message after an AI step that failed: the run stopped there (spec "How a step runs").
export const SEND_NOT_SENT = 'Not sent: a step before it failed';

// The client the room sends through: the index's, or null without its settings (a local api with no index).
export function sendsClient(env: PlanEnv): AutomationSendsClient | null {
  return indexAppClient(env);
}

export type SendsOutcome = {
  // The first refusal, for the run's reason; absent when every message was queued.
  failed?: string;
  // The webhook behind it, when it is paused or gone (a rule paused on it offers Fix Webhook).
  webhook?: string;
};

const where = (s: PlannedSend) => s.name ?? 'the webhook';

/** The messages to send once the run's AI steps are done: every one, or with `failedStep` (the AI step that failed)
 *  only those of the steps before it, each later one's line in `lines` settled as not sent. */
export function heldSends(
  sends: readonly PlannedSend[],
  failedStep: number | undefined,
  lines: AutomationStepLine[],
  offset: number,
): readonly PlannedSend[] {
  if (failedStep === undefined) return sends;
  return sends.filter((s) => {
    if (s.step < failedStep) return true;
    lines[offset + s.line] = { kind: 'action', ok: false, text: SEND_NOT_SENT };
    return false;
  });
}

// The run's messages: sent (`dry`: only said), each step's line in `lines` (at `offset + s.line`) settled.
export async function sendMessages(
  input: {
    client: AutomationSendsClient | null;
    planId: string;
    runId: string;
    rule: string;
    // Null for a run with no card (an Incoming Webhook call that named none).
    card: { key: number; title: string; url: string } | null;
    at: number;
    dry?: boolean;
  },
  sends: readonly PlannedSend[],
  lines: AutomationStepLine[],
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
  let results: AutomationSendResult[] | null = null;
  try {
    if (input.client)
      results = (
        await input.client.pushAutomationSends(
          input.planId,
          sendable.map((s) => ({
            key: key(s),
            webhookId: s.webhook,
            rule: input.rule,
            card: input.card,
            text: s.text,
            at: input.at,
          })),
        )
      ).results;
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
