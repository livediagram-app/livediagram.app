// What the webhook tests share: the key, a stand-in for accounts' teams and for DNS, and a way to add a document's
// webhook and send a message through it. Not a `.test.ts` file, so vitest doesn't collect it.

import type { Webhook } from '@liveworkspace/index-client';
import { body, call, h, type AppCall } from '../test-support';

// Base64 of the bytes 1 to 32.
export const WEBHOOK_KEY = 'AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=';

export type Roles = Record<string, { id: string; role: 'admin' | 'member' }[]>;

export type World = {
  // Each person's teams as accounts answers now; a person missing is in none.
  roles: Roles;
  // Accounts unreachable.
  accountsDown: boolean;
  // Each host's addresses; a host missing resolves to a public one.
  dns: Record<string, string[]>;
};

/** Answers accounts' team roles and DNS over HTTPS from `world`; anything else, as `other` says. */
export function answerWorld(
  world: World,
  other: (call: AppCall) => Response = () => new Response(null),
) {
  h.appAnswer = (c) => {
    if (c.url.endsWith('/api/account/index/teams')) {
      if (world.accountsDown) return new Response(null, { status: 503 });
      const userId = (c.body as { userId: string }).userId;
      const teams = (world.roles[userId] ?? []).map((t) => ({ ...t, name: t.id }));
      return Response.json({ teams });
    }
    if (c.url.startsWith('https://cloudflare-dns.com/')) {
      const url = new URL(c.url);
      const host = url.searchParams.get('name')!;
      const type = url.searchParams.get('type');
      const addresses = world.dns[host] ?? ['93.184.216.34'];
      const answers = addresses
        .filter((a) => (type === 'AAAA') === a.includes(':'))
        .map((data) => ({ type: type === 'AAAA' ? 28 : 1, data }));
      return Response.json({ Answer: answers });
    }
    return other(c);
  };
}

export const newWorld = (): World => ({ roles: {}, accountsDown: false, dns: {} });

/** Adds a webhook to a document, as its owner or (with `headers`, say an `X-Share-Code`) whoever the caller is. */
export async function addWebhook(
  auth: string,
  itemId: string,
  input: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Promise<{ webhook: Webhook; secret: string | null }> {
  const res = await call(`/items/${itemId}/webhooks`, {
    method: 'POST',
    auth,
    headers,
    body: {
      name: 'Hook',
      kind: 'json',
      url: 'https://hooks.example.com/in',
      ...input,
    },
  });
  if (res.status !== 201) throw new Error(`add failed: ${res.status} ${await res.text()}`);
  return body(res);
}

/** Queues one message through a webhook as a rule of the item's app would (`POST /app/items/:id/automation-sends`):
 *  the way a test makes a delivery, now that no event does. A new key each call unless `over` gives one. */
let sends = 0;
export async function sendThrough(
  itemId: string,
  webhookId: string,
  text = 'Hello',
  over: Record<string, unknown> = {},
  app: { name: string; key: string } = { name: 'liveplanner', key: 'lp-key' },
): Promise<Response> {
  sends += 1;
  return call(`/app/items/${itemId}/automation-sends`, {
    method: 'POST',
    auth: app.key,
    headers: { 'X-Index-App': app.name },
    body: {
      sends: [
        {
          key: `send-${sends}`,
          webhookId,
          rule: 'Tell the channel',
          subject: null,
          text,
          at: Date.now(),
          ...over,
        },
      ],
    },
  });
}

/** Every delivery row, oldest first. */
export const deliveries = () =>
  h.db.sql
    .prepare('SELECT * FROM webhook_deliveries ORDER BY id')
    .all()
    .map((r) => ({ ...r })) as Record<string, unknown>[];
