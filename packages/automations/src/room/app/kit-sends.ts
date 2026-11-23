// A rule's messages through the item's connections (blueprint item-engine.md "The kit": sends;
// liveworkspace/docs/specs/018-automations/automations.md "Connections";
// liveworkspace/docs/specs/004-index/webhooks.md "Automation sends"): pushed to the index with the app's key, each
// naming its rule and, when the run has one, its tab (a title and a link). Null without an index configured, so the
// step says it could not reach webhooks.
import type { AutomationSendsClient } from '../automation-sends';
import type { ItemSendSubject } from '../item/kit';

type Sends = AutomationSendsClient<ItemSendSubject>;
type Message = Parameters<Sends['push']>[1][number];

// The index's door for a rule's messages (@liveworkspace/index-client IndexAppClient `pushAutomationSends`).
export interface ItemSendsDoor {
  pushAutomationSends(
    itemId: string,
    messages: Pick<Message, 'key' | 'webhookId' | 'rule' | 'subject' | 'text' | 'at'>[],
    opts?: { check?: boolean },
  ): Promise<{ results: Awaited<ReturnType<Sends['push']>> }>;
}

export function kitSends(client: ItemSendsDoor | null): Sends | null {
  if (!client) return null;
  return {
    push: async (itemId, messages, opts) =>
      (
        await client.pushAutomationSends(
          itemId,
          messages.map((m) => ({
            key: m.key,
            webhookId: m.webhookId,
            rule: m.rule,
            subject: m.subject,
            text: m.text,
            at: m.at,
          })),
          ...(opts?.check ? [{ check: true }] : []),
        )
      ).results,
  };
}
