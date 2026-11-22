import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { actorsLine, digestLine, watchDigestEmail, type DigestPage } from './watch-digest-email';

// docs/specs/030-knowledgebase/watching.md "The daily digest email": what each line says, the cap, the escaping and
// the unsubscribe; and that only someone who turned it on is sent one.
const recipients = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock('../person/notify', async (original) => ({
  ...(await original<typeof import('../person/notify')>()),
  notifyRecipients: recipients.fn,
}));
const sent = vi.hoisted(() => ({ fn: vi.fn(async () => {}) }));
vi.mock('./client', async (original) => ({
  ...(await original<typeof import('./client')>()),
  emailEnabled: (env: { EMAIL?: unknown }) => !!env.EMAIL,
  sendEmail: sent.fn,
}));

const ENV = { APP_URL: 'https://www.liveknowledge.app' } as unknown as Env;
const KB = { id: 'kb', name: 'Handbook <Ops>' };
const pageOf = (over: Partial<DigestPage> = {}): DigestPage => ({
  tab: 'oncall',
  title: 'On-Call',
  kinds: ['saved'],
  actors: [{ id: 'user_p', name: 'Priya Shah' }],
  actorCount: 1,
  ...over,
});

describe('the digest’s lines', () => {
  it('names who and what, plainly', () => {
    expect(actorsLine([], 0)).toBe('');
    expect(actorsLine([{ id: 'a', name: 'Ada' }], 1)).toBe('Ada');
    expect(
      actorsLine(
        [
          { id: 'a', name: 'Ada' },
          { id: 'b', name: '' },
        ],
        2,
      ),
    ).toBe('Ada and Someone');
    expect(actorsLine([{ id: 'a', name: 'Ada' }], 4)).toBe('Ada and 3 others');
    expect(actorsLine([{ id: 'a', name: 'Ada' }], 2)).toBe('Ada and 1 other');
    expect(digestLine(pageOf())).toBe('Edited by Priya Shah');
    expect(digestLine(pageOf({ kinds: ['saved', 'moved', 'approved'] }))).toBe(
      'Edited, moved and approved by Priya Shah',
    );
    expect(digestLine(pageOf({ kinds: ['review_due'], actors: [], actorCount: 0 }))).toBe(
      'Verification lapsed',
    );
    expect(digestLine(pageOf({ kinds: [], actors: [] }))).toBe('Changed');
  });

  it('lists the pages, escaped, with the unsubscribe and the rest counted', () => {
    const email = watchDigestEmail(ENV, KB, [
      pageOf({ title: 'Deploys & <Rollbacks>' }),
      pageOf({ tab: 'x', title: '', kinds: ['deleted'], actors: [{ id: 'b', name: 'Bo' }] }),
    ]);
    expect(email.kind).toBe('WatchDigest');
    expect(email.subject).toBe('Changes to Pages You Watch in Handbook <Ops>');
    expect(email.html).toContain('Deploys &amp; &lt;Rollbacks&gt;');
    expect(email.html).toContain('Untitled Page');
    expect(email.html).toContain('Deleted by Bo');
    expect(email.html).not.toContain('<Ops>');
    expect(email.text).toContain('- Untitled Page: Deleted by Bo.');
    expect(email.unsubscribeUrl).toContain('settings');
    const many = watchDigestEmail(
      ENV,
      KB,
      Array.from({ length: 103 }, (_, i) => pageOf({ tab: `p${i}`, title: `Page ${i}` })),
    );
    expect(many.html).toContain('And 3 more.');
    expect(many.text).toContain('And 3 more.');
    expect(watchDigestEmail(ENV, { id: 'kb', name: ' ' }, [pageOf()]).subject).toContain(
      'a knowledgebase',
    );
  });
});

describe('notifyWatchDigests', () => {
  it('sends only to those who turned the digest on, and nothing with email off', async () => {
    const { notifyWatchDigests } = await import('./notifications');
    const email = watchDigestEmail(ENV, KB, [pageOf()]);
    recipients.fn.mockResolvedValueOnce(new Map([['user_a', 'a@x.test']]));
    const on = { ...ENV, EMAIL: {} } as unknown as Env;
    expect(
      await notifyWatchDigests(
        on,
        new Map([
          ['user_a', email],
          ['user_b', email],
          ['guest_1', email],
        ]),
      ),
    ).toEqual(['user_a']);
    expect(recipients.fn).toHaveBeenCalledWith(on, ['user_a', 'user_b'], 'notifyWatchDigest', {
      optIn: true,
    });
    expect(sent.fn).toHaveBeenCalledTimes(1);
    expect(await notifyWatchDigests(ENV, new Map([['user_a', email]]))).toEqual([]);
    expect(await notifyWatchDigests(on, new Map([['guest_1', email]]))).toEqual([]);
  });
});
