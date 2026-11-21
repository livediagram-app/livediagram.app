// What a delivery says: the signed JSON event, a Slack message, a Teams Adaptive Card (webhooks.md "Destinations").
// A connection sends a rule's message or Send Test's ping, nothing else.
import { WEBHOOK_PAYLOAD_MAX_BYTES } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { SLACK_SECTION_MAX, bodyFor, slackCut, summaryOf, type DeliveryEvent } from './messages';
import { newSigningSecret, signatureOf } from './sign';

const event = (over: Partial<DeliveryEvent> = {}): DeliveryEvent => ({
  eventId: 'e1',
  type: 'ping',
  app: 'liveworkspace',
  itemId: null,
  title: 'Team chat',
  actorId: null,
  actorName: null,
  detail: null,
  occurredAt: Date.UTC(2026, 10, 1, 9),
  url: null,
  ...over,
});

const subject = {
  ref: 'WI-48',
  title: 'Publish <pricing> page',
  url: 'https://www.liveplanner.app/project/p1#c',
};

// A rule's send from a plan: its message, its subject and its rule.
const sent = (over: Partial<DeliveryEvent> = {}, detail: Record<string, unknown> = {}) =>
  event({
    type: 'automation',
    app: 'liveplanner',
    itemId: 'p1',
    title: 'Sprint 4',
    actorName: 'Automation',
    url: 'https://www.liveplanner.app/project/p1',
    detail: {
      rule: 'Ship & tell',
      subject,
      text: 'Pricing is live <!channel>',
      ...detail,
    } as never,
    ...over,
  });

// A Teams body block's words: its one TextRun's.
const textOf = (b: { inlines: { text: string }[] }) => b.inlines[0]!.text;

describe('summaryOf', () => {
  it('is a test’s one sentence, or the message as the rule wrote it', () => {
    expect(summaryOf(event())).toBe('Test from liveworkspace: “Team chat” is set up and working.');
    expect(summaryOf(sent())).toBe('Pricing is live <!channel>');
    expect(summaryOf(event({ type: 'automation', detail: null }))).toBe('');
  });
});

describe('a test', () => {
  it('sends a plain endpoint the event, with no item', () => {
    expect(JSON.parse(bodyFor('json', event()))).toEqual({
      id: 'e1',
      type: 'ping',
      occurredAt: '2026-11-01T09:00:00.000Z',
      app: 'liveworkspace',
      item: null,
      actor: { id: null, name: null },
      detail: null,
    });
  });

  it('sends Slack its sentence, escaped, with no link back', () => {
    const slack = JSON.parse(bodyFor('slack', event({ title: 'A <b> & c' })));
    // The notification text is Slack markup too: escaped, so a name like <!channel> pings nobody.
    expect(slack.text).toBe(
      'Test from liveworkspace: “A &lt;b&gt; &amp; c” is set up and working.',
    );
    expect(
      JSON.stringify(JSON.parse(bodyFor('slack', event({ title: '<!channel>' })))),
    ).not.toContain('<!channel>');
    expect(slack.blocks[0].text.text).not.toContain('Open in');
    expect(slack.blocks[1].elements[0].text).toBe('liveworkspace · Test');
  });

  it('sends Teams one Adaptive Card with no button', () => {
    const body = JSON.parse(bodyFor('teams', event()));
    expect(body.type).toBe('message');
    const card = body.attachments[0];
    expect(card.contentType).toBe('application/vnd.microsoft.card.adaptive');
    expect(card.content.body.map(textOf)).toEqual([
      'Test from liveworkspace: “Team chat” is set up and working.',
      'liveworkspace · Test',
    ]);
    expect(card.content.actions).toEqual([]);
  });
});

describe('an automation send', () => {
  it('posts Slack the message, then the subject linked, then the rule, all escaped', () => {
    const slack = JSON.parse(bodyFor('slack', sent()));
    expect(slack.text).toBe('Pricing is live &lt;!channel&gt;');
    expect(slack.blocks[0].text.text).toBe(
      'Pricing is live &lt;!channel&gt;\nWI-48 Publish &lt;pricing&gt; page · <https://www.liveplanner.app/project/p1#c|Open in liveplanner>',
    );
    expect(slack.blocks[1].elements[0].text).toBe('Automation · Ship &amp; tell');
    // No subject: the item's own link; no subject and no link: the message alone.
    const plain = JSON.parse(bodyFor('slack', sent({}, { subject: null })));
    expect(plain.blocks[0].text.text).toBe(
      'Pricing is live &lt;!channel&gt;\n<https://www.liveplanner.app/project/p1|Open in liveplanner>',
    );
    const bare = JSON.parse(bodyFor('slack', sent({ url: null }, { subject: null })));
    expect(bare.blocks[0].text.text).toBe('Pricing is live &lt;!channel&gt;');
    // A subject whose link was dropped opens the item.
    const unlinked = JSON.parse(bodyFor('slack', sent({}, { subject: { ...subject, url: null } })));
    expect(unlinked.blocks[0].text.text).toContain(
      '<https://www.liveplanner.app/project/p1|Open in liveplanner>',
    );
  });

  it('names the item’s own app on the link, and a tab by its title alone', () => {
    const tab = { title: 'Retro', url: 'https://www.livediagram.app/d/d1?tab=t2' };
    const from = sent({ app: 'livediagram' }, { subject: tab });
    expect(JSON.parse(bodyFor('slack', from)).blocks[0].text.text).toBe(
      'Pricing is live &lt;!channel&gt;\nRetro · <https://www.livediagram.app/d/d1?tab=t2|Open in livediagram>',
    );
    const content = JSON.parse(bodyFor('teams', from)).attachments[0].content;
    expect(content.body.map(textOf)[1]).toBe('Retro');
    expect(content.actions[0]).toMatchObject({ title: 'Open in livediagram', url: tab.url });
  });

  it('sends Teams the message, the subject and the rule, with a button to the subject', () => {
    const content = JSON.parse(bodyFor('teams', sent())).attachments[0].content;
    expect(content.body.map(textOf)).toEqual([
      'Pricing is live <!channel>',
      'WI-48 Publish <pricing> page',
      'Automation · Ship & tell',
    ]);
    expect(content.actions[0].url).toBe('https://www.liveplanner.app/project/p1#c');
    const none = JSON.parse(bodyFor('teams', sent({}, { subject: null }))).attachments[0].content;
    expect(none.body).toHaveLength(2);
    expect(none.actions[0].url).toBe('https://www.liveplanner.app/project/p1');
    // A malformed detail reads as no rule, no message, and a subject of what is well formed.
    const odd = JSON.parse(
      bodyFor('teams', sent({}, { subject: { ref: 4, title: 'Loose', url: 1 }, rule: 5, text: 7 })),
    ).attachments[0].content;
    expect(odd.body.map(textOf)).toEqual(['', 'Loose', 'Automation · ']);
    const worse = JSON.parse(bodyFor('teams', sent({}, { subject: { title: 9 } }))).attachments[0]
      .content;
    expect(worse.body).toHaveLength(2);
  });

  it('sends Teams every text as a plain TextRun, never Markdown, so a title cannot make a link', () => {
    const title = '[Reset your password](https://evil.example) **now**';
    const content = JSON.parse(bodyFor('teams', sent({}, { subject: { ...subject, title } })))
      .attachments[0].content;
    for (const block of content.body) {
      expect(block.type).toBe('RichTextBlock');
      expect(block.inlines).toHaveLength(1);
      expect(block.inlines[0].type).toBe('TextRun');
    }
    expect(textOf(content.body[1])).toContain(title);
    expect(JSON.stringify(content.body)).not.toContain('"TextBlock"');
  });

  it('sends a plain endpoint the detail whole: the subject, and a plan’s card beside it', () => {
    const card = { key: 48, ref: 'WI-48', title: subject.title, url: subject.url };
    const json = JSON.parse(bodyFor('json', sent({}, { card })));
    expect(json.actor).toEqual({ id: null, name: 'Automation' });
    expect(json.item).toEqual({
      id: 'p1',
      title: 'Sprint 4',
      url: 'https://www.liveplanner.app/project/p1',
    });
    expect(json.detail).toEqual({
      rule: 'Ship & tell',
      subject,
      text: 'Pricing is live <!channel>',
      card,
    });
  });

  it(`keeps a Slack section within ${SLACK_SECTION_MAX} characters, even a message of escapes`, () => {
    const ampersands = sent({}, { text: '&'.repeat(2000) });
    const text: string = JSON.parse(bodyFor('slack', ampersands)).blocks[0].text.text;
    expect(text.length).toBeLessThanOrEqual(SLACK_SECTION_MAX);
    const [said] = text.split('\n');
    expect(said!.endsWith('&amp;…')).toBe(true);
    // Short text is kept whole; a cut never ends inside an escape or between a surrogate pair's halves.
    expect(slackCut('a &amp; b', 20)).toBe('a &amp; b');
    expect(slackCut('ab &amp; c', 7)).toBe('ab …');
    expect(slackCut('ab😀cd', 4)).toBe('ab…');
    expect(slackCut('abc', 0)).toBe('…');
  });
});

describe('the cap', () => {
  it(`keeps every body within ${WEBHOOK_PAYLOAD_MAX_BYTES} bytes, shortening the detail, then dropping it`, () => {
    const many = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [`k${i}`, 'é'.repeat(2000)]),
    );
    const shortened = JSON.parse(bodyFor('json', sent({ detail: many })));
    expect(Object.keys(shortened.detail)).toHaveLength(12);
    expect(shortened.detail.k0.length).toBe(500);
    const huge = Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [`k${i}`, 'é'.repeat(500)]),
    );
    expect(JSON.parse(bodyFor('json', sent({ detail: huge }))).detail).toBeNull();
    const title = 'é'.repeat(20_000);
    for (const kind of ['json', 'slack', 'teams'] as const) {
      for (const made of [event({ title }), sent({ title }, { text: 'é'.repeat(9_000) })]) {
        const body = bodyFor(kind, made);
        expect(new TextEncoder().encode(body).length).toBeLessThanOrEqual(
          WEBHOOK_PAYLOAD_MAX_BYTES,
        );
      }
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
