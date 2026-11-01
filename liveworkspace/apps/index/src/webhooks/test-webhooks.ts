// What the webhook tests share: the key, a stand-in for accounts' team roles and for DNS, and a way to add a
// webhook. Not a `.test.ts` file, so vitest doesn't collect it.

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

export async function addWebhook(
  auth: string,
  input: Record<string, unknown> = {},
): Promise<{ webhook: Webhook; secret: string | null }> {
  const res = await call('/webhooks', {
    method: 'POST',
    auth,
    body: {
      name: 'Hook',
      kind: 'json',
      url: 'https://hooks.example.com/in',
      events: ['created', 'renamed', 'commented', 'card_moved'],
      ...input,
    },
  });
  if (res.status !== 201) throw new Error(`add failed: ${res.status} ${await res.text()}`);
  return body(res);
}

/** Every delivery row, oldest first. */
export const deliveries = () =>
  h.db.sql
    .prepare('SELECT * FROM webhook_deliveries ORDER BY id')
    .all()
    .map((r) => ({ ...r })) as Record<string, unknown>[];
