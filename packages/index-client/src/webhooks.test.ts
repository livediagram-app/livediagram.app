import { describe, expect, it } from 'vitest';
import { createIndexAppClient, createIndexClient } from './client';
import {
  isWebhookEvent,
  isWebhookKind,
  isWebhookTopic,
  orderedTopics,
  splitTopic,
  topicsForApp,
  topicsOf,
  WEBHOOK_EVENT_APPS,
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_EVENTS,
  WEBHOOK_KINDS,
  WEBHOOK_TOPICS,
} from './webhooks';

type Seen = { url: string; method: string; body: unknown };

function fakeFetch(status = 200) {
  const seen: Seen[] = [];
  const doFetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    seen.push({
      url: String(input),
      method: init.method ?? 'GET',
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    return status === 204 ? new Response(null, { status }) : Response.json({}, { status });
  }) as typeof fetch;
  return { seen, doFetch };
}

describe('the webhooks contract', () => {
  it('names every event and kind, and tells them apart from anything else', () => {
    for (const event of WEBHOOK_EVENTS) {
      expect(isWebhookEvent(event)).toBe(true);
      expect(WEBHOOK_EVENT_LABELS[event]).toBeTruthy();
    }
    expect(isWebhookEvent('form_response')).toBe(true);
    expect(isWebhookEvent('mention')).toBe(true);
    expect(isWebhookEvent('ping')).toBe(false);
    expect(isWebhookEvent('edited')).toBe(false);
    for (const kind of WEBHOOK_KINDS) expect(isWebhookKind(kind)).toBe(true);
    expect(isWebhookKind('discord')).toBe(false);
  });

  it('gives each app its own events: card moves and forms are liveplanner’s alone', () => {
    expect(WEBHOOK_TOPICS).toHaveLength(47);
    expect(new Set(WEBHOOK_TOPICS).size).toBe(WEBHOOK_TOPICS.length);
    expect(WEBHOOK_EVENT_APPS.card_moved).toEqual(['liveplanner']);
    expect(WEBHOOK_EVENT_APPS.form_response).toEqual(['liveplanner']);
    expect(isWebhookTopic('livediagram:shared')).toBe(true);
    expect(isWebhookTopic('liveplanner:card_moved')).toBe(true);
    expect(isWebhookTopic('livediagram:card_moved')).toBe(false);
    expect(isWebhookTopic('livehuddle:form_response')).toBe(false);
    expect(isWebhookTopic('shared')).toBe(false);
    expect(isWebhookTopic('nope:shared')).toBe(false);
    expect(splitTopic('livedesign:mention')).toEqual({ app: 'livedesign', event: 'mention' });
  });

  it('reads a bare event as every app that sends it, and keeps topics in order', () => {
    expect(topicsOf('card_moved')).toEqual(['liveplanner:card_moved']);
    expect(topicsOf('shared')).toEqual([
      'livediagram:shared',
      'liveplanner:shared',
      'livedocuments:shared',
      'livedesign:shared',
      'livehuddle:shared',
    ]);
    expect(topicsOf('livediagram:shared')).toEqual(['livediagram:shared']);
    expect(topicsOf('livediagram:card_moved')).toEqual([]);
    expect(topicsOf(4)).toEqual([]);
    expect(orderedTopics(['liveplanner:shared', 'livediagram:created', 'liveplanner:shared'])).toEqual([
      'livediagram:created',
      'liveplanner:shared',
    ]);
    expect(topicsForApp(['livediagram:created', 'liveplanner:shared'], 'liveplanner')).toEqual([
      'liveplanner:shared',
    ]);
  });

  it("calls each webhook route on the person's client", async () => {
    const { seen, doFetch } = fakeFetch();
    const client = createIndexClient({ getToken: () => 't', fetch: doFetch });
    await client.listWebhooks();
    await client.createWebhook({
      name: 'n',
      kind: 'slack',
      url: 'u',
      events: ['livediagram:created'],
    });
    await client.updateWebhook('w 1', { paused: true });
    await client.testWebhook('w1');
    await client.webhookDeliveries('w1');
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      'GET /api/index/webhooks',
      'POST /api/index/webhooks',
      'PATCH /api/index/webhooks/w%201',
      'POST /api/index/webhooks/w1/test',
      'GET /api/index/webhooks/w1/deliveries',
    ]);
    expect(seen[1]!.body).toEqual({
      name: 'n',
      kind: 'slack',
      url: 'u',
      events: ['livediagram:created'],
    });
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
    const move = { cardId: 'c', cardKey: 4, card: 'Fix', from: 'Doing', to: 'Done', at: 1 };
    await app.pushCardMoves('p1', [move]);
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      'DELETE /api/index/webhooks/w1',
      'PUT /i/app/items/p1/card-moves',
    ]);
    expect(seen[1]!.body).toEqual({ moves: [move] });
  });
});
