import { describe, expect, it } from 'vitest';
import { createIndexAppClient, createIndexClient } from './client';
import {
  AUTOMATION_SENDS_MAX,
  isWebhookKind,
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_KINDS,
  WEBHOOKS_PER_DOCUMENT_MAX,
  type AutomationSend,
} from './webhooks';

type Seen = { url: string; method: string; body: unknown; headers: Headers };

function fakeFetch(status = 200) {
  const seen: Seen[] = [];
  const doFetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    seen.push({
      url: String(input),
      method: init.method ?? 'GET',
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      headers: new Headers(init.headers),
    });
    return status === 204 ? new Response(null, { status }) : Response.json({}, { status });
  }) as typeof fetch;
  return { seen, doFetch };
}

describe('the connections contract', () => {
  it('names every kind and the two things a connection sends, and no event', () => {
    // A connection hears no events: only a rule's message and Send Test's ping are ever delivered.
    expect(WEBHOOK_EVENT_LABELS).toEqual({ automation: 'Automation', ping: 'Test' });
    expect(AUTOMATION_SENDS_MAX).toBe(5);
    for (const kind of WEBHOOK_KINDS) expect(isWebhookKind(kind)).toBe(true);
    expect(isWebhookKind('discord')).toBe(false);
    expect(WEBHOOKS_PER_DOCUMENT_MAX).toBe(10);
  });

  it("calls each webhook route on the person's client, through the document's share link when given", async () => {
    const { seen, doFetch } = fakeFetch();
    const client = createIndexClient({ getToken: () => 't', fetch: doFetch });
    await client.listWebhooks('i 1');
    await client.createWebhook('i1', { name: 'n', kind: 'slack', url: 'u' }, { code: 'abc' });
    await client.updateWebhook('w 1', { paused: true });
    await client.testWebhook('w1');
    await client.webhookDeliveries('w1', { code: 'abc' });
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      'GET /api/index/items/i%201/webhooks',
      'POST /api/index/items/i1/webhooks',
      'PATCH /api/index/webhooks/w%201',
      'POST /api/index/webhooks/w1/test',
      'GET /api/index/webhooks/w1/deliveries',
    ]);
    expect(seen[1]!.body).toEqual({ name: 'n', kind: 'slack', url: 'u' });
    expect(seen[2]!.body).toEqual({ paused: true });
    expect(seen[0]!.headers.get('X-Share-Code')).toBeNull();
    expect(seen[1]!.headers.get('X-Share-Code')).toBe('abc');
    expect(seen[4]!.headers.get('X-Share-Code')).toBe('abc');
  });

  it('deletes a webhook, and pushes card moves with the app client', async () => {
    const { seen, doFetch } = fakeFetch(204);
    await createIndexClient({ getToken: () => 't', fetch: doFetch }).deleteWebhook('w1');
    const app = createIndexAppClient({
      app: 'liveplanner',
      key: 'k',
      baseUrl: '/i',
      fetch: doFetch,
    });
    const move = {
      cardId: 'c',
      cardKey: 4,
      card: 'Fix',
      from: 'Doing',
      to: 'Done',
      actorId: 'user_a',
      at: 1,
    };
    await app.pushCardMoves('p1', [move]);
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      'DELETE /api/index/webhooks/w1',
      'PUT /i/app/items/p1/card-moves',
    ]);
    expect(seen[1]!.body).toEqual({ moves: [move] });
  });

  it('pushes automation sends with the app client, answering each send', async () => {
    const seen: Seen[] = [];
    const results = [
      { key: 'a', queued: true },
      {
        key: 'b',
        queued: false,
        reason: 'Too many messages waiting for this connection',
        code: 'webhook_full',
      },
    ];
    const doFetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      seen.push({
        url: String(input),
        method: init.method ?? 'GET',
        body: JSON.parse(String(init.body)),
        headers: new Headers(init.headers),
      });
      return Response.json({ results });
    }) as typeof fetch;
    const app = createIndexAppClient({
      app: 'liveplanner',
      key: 'k',
      baseUrl: '/i',
      fetch: doFetch,
    });
    // A subject (a card or a tab), none, and the card field from before subjects, sent as they are.
    const sends: AutomationSend[] = [
      {
        key: 'a',
        webhookId: 'w1',
        rule: 'Tell',
        subject: { ref: 'WI-48', title: 'Publish', url: 'https://liveplanner.app/project/p 1' },
        text: 'Live',
        at: 1,
      },
      { key: 'b', webhookId: 'w2', rule: 'Tell', subject: null, text: 'Live', at: 1 },
      {
        key: 'c',
        webhookId: 'w2',
        rule: 'Tell',
        card: { key: 48, title: 'Publish', url: 'https://liveplanner.app/project/p 1' },
        text: 'Live',
        at: 1,
      },
    ];
    expect(await app.pushAutomationSends('p 1', sends)).toEqual({ results });
    expect(seen[0]).toMatchObject({
      method: 'POST',
      url: '/i/app/items/p%201/automation-sends',
      body: { sends },
    });
    expect(seen[0]!.headers.get('Authorization')).toBe('Bearer k');
    expect(seen[0]!.headers.get('X-Index-App')).toBe('liveplanner');
    const refused = createIndexAppClient({
      app: 'livediagram',
      key: 'k',
      fetch: (async () => Response.json({ error: 'wrong_app' }, { status: 403 })) as typeof fetch,
    });
    await expect(refused.pushAutomationSends('p1', [])).rejects.toMatchObject({
      status: 403,
      code: 'wrong_app',
    });
  });
});
