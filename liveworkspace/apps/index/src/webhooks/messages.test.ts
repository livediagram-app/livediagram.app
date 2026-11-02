// What a delivery says: the signed JSON event, a Slack message, a Teams Adaptive Card (webhooks.md "Destinations").
import { WEBHOOK_PAYLOAD_MAX_BYTES } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { bodyFor, summaryOf, type DeliveryEvent } from './messages';
import { newSigningSecret, signatureOf } from './sign';

const event = (over: Partial<DeliveryEvent> = {}): DeliveryEvent => ({
  eventId: 'e1',
  type: 'created',
  app: 'liveplanner',
  itemId: 'p1',
  title: 'Sprint 4',
  actorId: 'user_ada',
  actorName: 'Ada',
  detail: null,
  occurredAt: Date.UTC(2026, 10, 1, 9),
  url: 'https://www.liveplanner.app/project/p1',
  ...over,
});

describe('summaryOf', () => {
  it.each<[Partial<DeliveryEvent>, string]>([
    [{}, 'Ada made “Sprint 4”'],
    [{ actorName: null, title: '' }, 'Someone made “Untitled”'],
    [{ type: 'renamed', detail: { from: 'Sprint' } }, 'Ada renamed “Sprint” to “Sprint 4”'],
    [{ type: 'renamed' }, 'Ada renamed “Sprint 4”'],
    [{ type: 'moved', detail: { folderName: 'Q4' } }, 'Ada moved “Sprint 4” to “Q4”'],
    [{ type: 'moved', detail: { folderName: null } }, 'Ada moved “Sprint 4”'],
    [{ type: 'trashed' }, 'Ada moved “Sprint 4” to the Trash'],
    [{ type: 'shared', detail: { level: 'edit' } }, 'Ada shared “Sprint 4” (edit link)'],
    [{ type: 'shared' }, 'Ada shared “Sprint 4”'],
    [
      { type: 'commented', detail: { text: 'Looks good' } },
      'Ada commented on “Sprint 4”: Looks good',
    ],
    [{ type: 'commented' }, 'Ada commented on “Sprint 4”'],
    [
      { type: 'action_assigned', detail: { action: 'Ship', assigneeName: 'Bo' } },
      'Ada assigned “Ship” to Bo on “Sprint 4”',
    ],
    [{ type: 'action_assigned', detail: {} }, 'Ada assigned “Untitled” to someone on “Sprint 4”'],
    [{ type: 'action_done', detail: { action: 'Ship' } }, 'Ada finished “Ship” on “Sprint 4”'],
    [
      { type: 'card_moved', detail: { card: 'Fix sign-in', from: 'Doing', to: 'Done' } },
      'Ada moved “Fix sign-in” from Doing to Done on “Sprint 4”',
    ],
    [{ type: 'card_moved', detail: {} }, 'Ada moved “Untitled” from ? to ? on “Sprint 4”'],
    [
      { type: 'ping', title: 'Team chat' },
      'Test from liveworkspace: “Team chat” is set up and working.',
    ],
  ])('says %o as one sentence', (over, sentence) => {
    expect(summaryOf(event(over))).toBe(sentence);
  });

  it('cuts a long comment', () => {
    const text = summaryOf(event({ type: 'commented', detail: { text: 'x'.repeat(1000) } }));
    expect(text.length).toBeLessThan(340);
    expect(text.endsWith('…')).toBe(true);
  });
});

describe('bodyFor', () => {
  it('sends a plain endpoint the event, with its item and actor', () => {
    expect(
      JSON.parse(bodyFor('json', event({ detail: { level: 'view' }, type: 'shared' }))),
    ).toEqual({
      id: 'e1',
      type: 'shared',
      occurredAt: '2026-11-01T09:00:00.000Z',
      app: 'liveplanner',
      item: { id: 'p1', title: 'Sprint 4', url: 'https://www.liveplanner.app/project/p1' },
      actor: { id: 'user_ada', name: 'Ada' },
      detail: { level: 'view' },
    });
    expect(JSON.parse(bodyFor('json', event({ itemId: null, type: 'ping' }))).item).toBeNull();
  });

  it('sends Slack a sentence with a link back, its control characters escaped', () => {
    const body = JSON.parse(bodyFor('slack', event({ title: 'A <b> & c' })));
    expect(body.text).toBe('Ada made “A <b> & c”');
    expect(body.blocks[0].text.text).toBe(
      'Ada made “A &lt;b&gt; &amp; c”\n<https://www.liveplanner.app/project/p1|Open in liveplanner>',
    );
    expect(body.blocks[1].elements[0].text).toBe('liveplanner · Item Created');
    const test = JSON.parse(
      bodyFor('slack', event({ type: 'ping', url: null, app: 'liveworkspace' })),
    );
    expect(test.blocks[0].text.text).not.toContain('Open in');
    expect(test.blocks[1].elements[0].text).toBe('liveworkspace · Test');
  });

  it('sends Teams one Adaptive Card with a button back', () => {
    const body = JSON.parse(bodyFor('teams', event()));
    expect(body.type).toBe('message');
    const card = body.attachments[0];
    expect(card.contentType).toBe('application/vnd.microsoft.card.adaptive');
    expect(card.content.body[0].text).toBe('Ada made “Sprint 4”');
    expect(card.content.actions).toEqual([
      {
        type: 'Action.OpenUrl',
        title: 'Open in liveplanner',
        url: 'https://www.liveplanner.app/project/p1',
      },
    ]);
    expect(
      JSON.parse(bodyFor('teams', event({ url: null }))).attachments[0].content.actions,
    ).toEqual([]);
  });

  it(`keeps every body within ${WEBHOOK_PAYLOAD_MAX_BYTES} bytes, shortening the detail, then dropping it`, () => {
    const many = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [`k${i}`, 'é'.repeat(2000)]),
    );
    const shortened = JSON.parse(bodyFor('json', event({ detail: many })));
    expect(Object.keys(shortened.detail)).toHaveLength(12);
    expect(shortened.detail.k0.length).toBe(500);
    const huge = Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [`k${i}`, 'é'.repeat(500)]),
    );
    expect(JSON.parse(bodyFor('json', event({ detail: huge }))).detail).toBeNull();
    const title = 'é'.repeat(20_000);
    for (const kind of ['json', 'slack', 'teams'] as const) {
      const body = bodyFor(kind, event({ title, detail: { text: 'x' }, type: 'commented' }));
      expect(new TextEncoder().encode(body).length).toBeLessThanOrEqual(WEBHOOK_PAYLOAD_MAX_BYTES);
    }
  });
});

describe('signatures', () => {
  it('signs `<timestamp>.<body>` with HMAC-SHA256 under the secret, as a receiver recomputes it', async () => {
    const secret = newSigningSecret();
    expect(secret).toMatch(/^whsec_[A-Za-z0-9_-]{43}$/);
    const sig = await signatureOf('whsec_test', 1_700_000_000, '{"a":1}');
    // Recomputed independently with node's crypto.
    const { createHmac } = await import('node:crypto');
    const expected = createHmac('sha256', 'whsec_test').update('1700000000.{"a":1}').digest('hex');
    expect(sig).toBe(`v1=${expected}`);
    expect(await signatureOf('whsec_test', 1_700_000_001, '{"a":1}')).not.toBe(sig);
  });
});
