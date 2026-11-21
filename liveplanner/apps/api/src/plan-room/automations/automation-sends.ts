// A run's outgoing actions sent (docs/specs/026-plan/automations.md "Outgoing actions"; blueprint automations.md
// "Phase 2", "Runner additions"; liveworkspace/docs/specs/004-index/webhooks.md "Automation sends"). The sending (one
// push a run, each message keyed `${runId}:${step}`, each answer settling its step's line) is
// @liveworkspace/automations/room's (liveworkspace/docs/specs/018-automations/blueprints/engine.md "The room entry");
// here it goes through the index's app client with the app's own key, each message about the run's card.
import type { AutomationStepLine, PlannedSend } from '@liveplanner/items';
import type { AutomationSend, IndexAppClient } from '@liveworkspace/index-client';
import {
  sendMessages as sendThrough,
  type AutomationSendsClient as MessagesClient,
  type SendsOutcome,
} from '@liveworkspace/automations/room';
import { indexAppClient } from '../../index-service';
import type { PlanEnv } from '../../types';

export {
  SENDS_UNREACHABLE,
  SEND_EMPTY,
  SEND_NOT_SENT,
  heldSends,
  type SendsOutcome,
} from '@liveworkspace/automations/room';

// The index's automation sends (packages/index-client webhooks.ts). The room's client is the index's app client;
// tests hand in their own with just this method.
export type { AutomationSend, AutomationSendResult } from '@liveworkspace/index-client';
export type AutomationSendsClient = Pick<IndexAppClient, 'pushAutomationSends'>;

// The client the room sends through: the index's, or null without its settings (a local api with no index).
export function sendsClient(env: PlanEnv): AutomationSendsClient | null {
  return indexAppClient(env);
}

// What a message says of the card its run is about (null for a run with no card).
type SendCard = NonNullable<AutomationSend['card']>;

// The index's client as the engine sends through it: a plan's messages name their card under `card`.
const messagesClient = (client: AutomationSendsClient): MessagesClient<SendCard> => ({
  push: async (planId, messages) =>
    (
      await client.pushAutomationSends(
        planId,
        messages.map((m) => ({
          key: m.key,
          webhookId: m.webhookId,
          rule: m.rule,
          card: m.subject,
          text: m.text,
          at: m.at,
        })),
      )
    ).results,
});

// The run's messages: sent (`dry`: only said), each step's line in `lines` (at `offset + s.line`) settled.
export function sendMessages(
  input: {
    client: AutomationSendsClient | null;
    planId: string;
    runId: string;
    rule: string;
    // Null for a run with no card (an Incoming Webhook call that named none).
    card: SendCard | null;
    at: number;
    dry?: boolean;
  },
  sends: readonly PlannedSend[],
  lines: AutomationStepLine[],
  offset: number,
): Promise<SendsOutcome> {
  return sendThrough(
    {
      client: input.client ? messagesClient(input.client) : null,
      itemId: input.planId,
      runId: input.runId,
      rule: input.rule,
      subject: input.card,
      at: input.at,
      ...(input.dry ? { dry: true } : {}),
    },
    sends,
    lines,
    offset,
  );
}
