import { describe, expect, it } from 'vitest';
import { createIndexAppClient, createIndexClient } from './client';
import {
  isWebhookEvent,
  isWebhookKind,
  isWebhookWho,
  WEBHOOK_EVENT_APPS,
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_EVENTS,
  WEBHOOK_KINDS,
  WEBHOOK_WHO,
  WEBHOOKS_PER_DOCUMENT_MAX,
  webhookEventsOf,
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

describe('the webhooks contract', () => {
  it('names every event, kind and Who Did It, and tells them apart from anything else', () => {
    for (const event of WEBHOOK_EVENTS) {
      expect(isWebhookEvent(event)).toBe(true);
      expect(WEBHOOK_EVENT_LABELS[event]).toBeTruthy();
    }
    expect(isWebhookEvent('form_response')).toBe(true);
    // Retired: a document is never made again, and mentions are gone.
    expect(isWebhookEvent('created')).toBe(false);
    expect(isWebhookEvent('mention')).toBe(false);
    expect(isWebhookEvent('ping')).toBe(false);
    expect(isWebhookEvent('edited')).toBe(false);
    for (const kind of WEBHOOK_KINDS) expect(isWebhookKind(kind)).toBe(true);
    expect(isWebhookKind('discord')).toBe(false);
    expect(WEBHOOK_WHO).toEqual(['anyone', 'me']);
    expect(isWebhookWho('me')).toBe(true);
    expect(isWebhookWho('everyone')).toBe(false);
    expect(WEBHOOKS_PER_DOCUMENT_MAX).toBe(10);
  });

  it('gives each app its own events: card moves and forms are liveplanner’s alone', () => {
    expect(WEBHOOK_EVENT_APPS.card_moved).toEqual(['liveplanner']);
    expect(WEBHOOK_EVENT_APPS.form_response).toEqual(['liveplanner']);
    expect(webhookEventsOf('liveplanner')).toEqual([...WEBHOOK_EVENTS]);
    expect(webhookEventsOf('livediagram')).toEqual([
      'renamed',
      'moved',
      'trashed',
      'shared',
      'commented',
      'action_assigned',
      'action_done',
    ]);
  });

  it("calls each webhook route on the person's client, through the document's share link when given", async () => {
    const { seen, doFetch } = fakeFetch();
    const client = createIndexClient({ getToken: () => 't', fetch: doFetch });
    await client.listWebhooks('i 1');
    await client.createWebhook(
      'i1',
      { name: 'n', kind: 'slack', url: 'u', events: ['shared'], who: 'me' },
      { code: 'abc' },
    );
    await client.updateWebhook('w 1', { paused: true, who: 'anyone' });
    await client.testWebhook('w1');
    await client.webhookDeliveries('w1', { code: 'abc' });
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      'GET /api/index/items/i%201/webhooks',
      'POST /api/index/items/i1/webhooks',
      'PATCH /api/index/webhooks/w%201',
      'POST /api/index/webhooks/w1/test',
      'GET /api/index/webhooks/w1/deliveries',
    ]);
    expect(seen[1]!.body).toEqual({
      name: 'n',
      kind: 'slack',
      url: 'u',
      events: ['shared'],
      who: 'me',
    });
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
});
