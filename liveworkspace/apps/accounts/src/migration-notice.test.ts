import { describe, expect, it, vi } from 'vitest';
import type { Env } from './env.ts';
import {
  isPartUrl,
  migrationNotice,
  MIGRATION_NOTICE_PATH,
  NOTICE_BATCH_MAX,
  NOTICE_DOCUMENTS_SHOWN,
  NOTICE_SUBJECT,
  noticeEmail,
  readNoticeBody,
  type NoticeRecipient,
  type NoticeResult,
} from './migration-notice.ts';
import { testD1 } from './test-d1.ts';

// crypto.subtle.timingSafeEqual is the Workers runtime's own; Node's crypto has none.
vi.mock('./secrets.ts', () => ({ sameSecret: async (a: string, b: string) => a === b }));

const ADMIN = 'admin-token';
const FROM = 'liveworkspace <support@liveworkspace.app>';

const BASE = { ENVIRONMENT: 'production', BASE_URL: 'https://www.liveworkspace.app' } as const;

const everything: NoticeRecipient = {
  email: 'ali@example.com',
  name: 'Ali',
  splitDocuments: [
    {
      name: 'Launch',
      parts: [
        { app: 'livedocuments', title: 'Deck', url: 'https://www.livedocuments.app/document/d1' },
        { app: 'liveplanner', title: 'Board', url: 'https://www.liveplanner.app/project/p1' },
      ],
    },
  ],
  hasTokens: true,
  hasTeams: true,
  hasAiTool: true,
  hadDrive: true,
};

type Sent = { from: unknown; to: string; subject: string; html: string; text?: string };

function setup(
  over: Partial<Env> = {},
  send: (m: Sent) => Promise<{ messageId: string }> = async () => ({ messageId: 'm-1' }),
) {
  const { db, sql } = testD1();
  const sent: Sent[] = [];
  const env = {
    ...BASE,
    ADMIN_TOKEN: ADMIN,
    EMAIL_FROM: 'sign-in@liveplanner.app',
    NOTICE_FROM: FROM,
    AUTH_DB: db,
    EMAIL: {
      send: async (m: Sent) => {
        sent.push(m);
        return send(m);
      },
    },
    ...over,
  } as unknown as Env;
  const addUser = (email: string) =>
    sql
      .prepare(
        `INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, 1, 'x', 'x')`,
      )
      .run(`user_${email}`, email, email);
  const call = async (body: unknown, token = ADMIN) => {
    const res = await migrationNotice(
      new Request(`https://www.liveworkspace.app${MIGRATION_NOTICE_PATH}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      env,
      () => 1_000,
    );
    return {
      status: res.status,
      body: (res.status === 200 || res.status >= 400
        ? await res.json().catch(() => null)
        : null) as {
        sent: number;
        skipped: number;
        failed: number;
        previewed?: number;
        results: NoticeResult[];
        message?: string;
        error?: string;
      },
    };
  };
  return { sql, sent, addUser, call };
}

describe('noticeEmail', () => {
  it('is the copy, in liveworkspace’s frame, with every section when every flag is set', () => {
    const { subject, html, text } = noticeEmail(BASE, everything);
    expect(subject).toBe('livediagram is now part of liveworkspace');
    expect(html).toContain(
      '<img src="https://www.liveworkspace.app/email/liveworkspace-mark-64.png"',
    );
    expect(html).toContain('>live</span>workspace<');
    expect(html).toContain('>livediagram is now part of liveworkspace</h1>');
    expect(html).toContain('href="https://www.livediagram.app"');
    expect(html).toContain('>Open livediagram</a>');
    expect(html).toContain('Thanks for using livediagram,<br>The liveworkspace team');
    expect(text).toBe(
      [
        'Hi Ali,',
        '',
        'livediagram has moved to its new home as part of liveworkspace, a set of apps that share one account: livediagram for diagrams, liveplanner for plans, livedocuments for documents and livedesign for designs.',
        '',
        "There's nothing you need to do. Your work is all still there at the same address, https://www.livediagram.app. Sign in with the same email (ali@example.com) using a code we send you, or with Google.",
        '',
        'Some of your documents now live in more than one app. Where a document mixed a diagram with pages, a plan or a design, each part now opens in the app made for it. The diagram stays in livediagram and links to the rest:',
        '- Launch: Deck in livedocuments (https://www.livedocuments.app/document/d1)',
        '- Launch: Board in liveplanner (https://www.liveplanner.app/project/p1)',
        '',
        "Your API tokens still work until they expire. You'll now find them at https://www.liveworkspace.app/account/tokens.",
        '',
        "Your teams came across with their members and roles. They're now managed in your liveworkspace account.",
        '',
        'If you use livediagram from an AI tool, you may need to reconnect it once: remove livediagram from the tool, then add it again. You can now connect liveplanner, livedocuments and livedesign to your AI tool too.',
        '',
        'Google Drive sync needs connecting again, once. Nothing in your Drive was changed. Connect at https://www.liveworkspace.app/drive/connect and it syncs from every liveworkspace app.',
        '',
        'Privacy: we changed our authentication provider, so our old one (Clerk) no longer holds your details. The updated policy is at https://www.liveworkspace.app/privacy.',
        '',
        'If anything looks wrong or you have a question, use our contact form: https://www.liveplanner.app/form/90Bgj5sY9eTpVrjhx9tTZj',
        '',
        'Open livediagram: https://www.livediagram.app',
        '',
        'Thanks for using livediagram,',
        'The liveworkspace team',
      ].join('\n'),
    );
    expect(html).toContain('href="https://www.livedocuments.app/document/d1"');
    expect(html).toContain('>Launch</strong>');
    expect(`${html}${text}`).not.toContain('—');
  });

  it('leaves out every section whose flag is unset, and greets with no name as “Hi,”', () => {
    const { html, text } = noticeEmail(BASE, { email: 'cy@example.com', name: '' });
    expect(text.startsWith('Hi,\n')).toBe(true);
    for (const missing of [
      'more than one app',
      'API tokens',
      'teams came across',
      'AI tool',
      'Google Drive',
    ]) {
      expect(text).not.toContain(missing);
      expect(html).not.toContain(missing);
    }
    expect(text).toContain('Privacy:');
    expect(text).toContain('contact form');
  });

  it('shows each section alone when only its flag is set', () => {
    const only = (r: Partial<NoticeRecipient>) =>
      noticeEmail(BASE, { email: 'a@b.co', name: 'A', ...r }).text;
    expect(only({ hasTokens: true })).toContain('API tokens');
    expect(only({ hasTokens: true })).not.toContain('teams came across');
    expect(only({ hasTeams: true })).toContain('teams came across');
    expect(only({ hasAiTool: true })).toContain('AI tool');
    expect(only({ hadDrive: true })).toContain('Google Drive');
    expect(only({ splitDocuments: [] })).not.toContain('more than one app');
  });

  it('lists the first ten split documents and counts the rest', () => {
    const docs = Array.from({ length: 12 }, (_, i) => ({
      name: `Doc ${i + 1}`,
      parts: [
        {
          app: 'liveplanner' as const,
          title: 'Board',
          url: `https://www.liveplanner.app/project/p${i}`,
        },
      ],
    }));
    const email = (r: Partial<NoticeRecipient>) =>
      noticeEmail(BASE, { email: 'a@b.co', name: 'A', ...r });
    const listed = email({ splitDocuments: docs });
    expect(NOTICE_DOCUMENTS_SHOWN).toBe(10);
    expect(listed.text).toContain('- Doc 10: Board');
    expect(listed.text).not.toContain('Doc 11');
    expect(listed.text).toContain('And 2 more documents: open any of them in livediagram');
    expect(listed.html).toContain('And 2 more documents');
    // The whole count, when the tool sent only the first ten.
    expect(email({ splitDocuments: docs.slice(0, 10), splitDocumentsTotal: 31 }).text).toContain(
      'And 21 more documents',
    );
    expect(email({ splitDocuments: docs.slice(0, 10), splitDocumentsTotal: 11 }).text).toContain(
      'And 1 more document:',
    );
    expect(email({ splitDocuments: docs.slice(0, 10) }).text).not.toContain('more document');
  });

  it('escapes every value the recipient carries', () => {
    const { html } = noticeEmail(BASE, {
      email: 'x"y@example.com',
      name: '<script>alert(1)</script>',
      splitDocuments: [
        {
          name: 'A & <b>B</b>',
          parts: [
            {
              app: 'livedesign',
              title: '"><img src=x>',
              url: 'https://www.livedesign.app/design/a?b="c"&d=<e>',
            },
          ],
        },
      ],
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>B</b>');
    expect(html).not.toContain('<img src=x>');
    expect(html).toContain('Hi &#60;script&#62;alert(1)&#60;/script&#62;,');
    expect(html).toContain('A &#38; &#60;b&#62;B&#60;/b&#62;');
    expect(html).toContain(
      'href="https://www.livedesign.app/design/a?b=&#34;c&#34;&#38;d=&#60;e&#62;"',
    );
    expect(html).toContain('x&#34;y@example.com');
  });

  it('drops a base address’s trailing slashes, quickly even for a long run of them', () => {
    const env = { ...BASE, BASE_URL: 'https://www.liveworkspace.app//' };
    expect(noticeEmail(env, everything).text).toContain(
      'https://www.liveworkspace.app/account/tokens',
    );
    // The old pattern took seconds on this; the scan is linear, inside the test's own timeout with room.
    const long = noticeEmail({ ...BASE, BASE_URL: `https://x${'/'.repeat(50_000)}` }, everything);
    expect(long.text).toContain('https://x/account/tokens');
  });

  it('links staging’s addresses in staging', () => {
    const { text } = noticeEmail(
      { ENVIRONMENT: 'staging', BASE_URL: 'https://staging.liveworkspace.app' },
      everything,
    );
    expect(text).toContain('https://staging.livediagram.app');
    expect(text).toContain('https://staging.liveworkspace.app/account/tokens');
  });
});

describe('readNoticeBody', () => {
  const bad = (body: unknown) => {
    const read = readNoticeBody(body);
    return 'error' in read ? read.error : null;
  };
  const one = (r: Record<string, unknown>) => ({
    recipients: [{ email: 'a@b.co', name: '', ...r }],
  });
  const doc = (part: Record<string, unknown>, name: unknown = 'Doc') =>
    one({
      splitDocuments: [
        {
          name,
          parts: [
            {
              app: 'liveplanner',
              title: 'T',
              url: 'https://www.liveplanner.app/project/p',
              ...part,
            },
          ],
        },
      ],
    });

  it('takes a good body, lower-casing addresses and trimming names', () => {
    expect(
      readNoticeBody({ recipients: [{ email: 'A@B.co', name: ' Al ' }], dryRun: true }),
    ).toEqual({
      recipients: [{ email: 'a@b.co', name: 'Al' }],
      dryRun: true,
    });
    expect(bad(doc({}))).toBeNull();
  });

  it('refuses every bad field', () => {
    expect(bad(null)).toMatch(/object/);
    expect(bad({ recipients: [] })).toMatch(/1 to 50/);
    expect(
      bad({
        recipients: Array.from({ length: NOTICE_BATCH_MAX + 1 }, (_, i) => ({
          email: `a${i}@b.co`,
          name: '',
        })),
      }),
    ).toMatch(/1 to 50/);
    expect(bad({ recipients: [{ email: 'a@b.co', name: '' }], dryRun: 'yes' })).toMatch(/dryRun/);
    expect(bad({ recipients: ['x'] })).toMatch(/object/);
    expect(bad(one({ email: 'nope' }))).toMatch(/email/);
    expect(bad(one({ email: `${'a'.repeat(250)}@b.co` }))).toMatch(/email/);
    expect(bad(one({ name: 7 }))).toMatch(/name/);
    expect(bad(one({ name: 'a'.repeat(121) }))).toMatch(/name/);
    expect(bad(one({ name: 'line\nbreak' }))).toMatch(/name/);
    expect(bad(one({ hasTokens: 'yes' }))).toMatch(/hasTokens/);
    expect(bad(one({ hadDrive: 1 }))).toMatch(/hadDrive/);
    expect(bad(one({ splitDocuments: 'x' }))).toMatch(/splitDocuments/);
    expect(bad(one({ splitDocumentsTotal: 1.5 }))).toMatch(/splitDocumentsTotal/);
    expect(bad(one({ splitDocumentsTotal: '3' }))).toMatch(/splitDocumentsTotal/);
    expect(
      bad({ ...doc({}), recipients: [{ ...doc({}).recipients[0], splitDocumentsTotal: 0 }] }),
    ).toMatch(/no smaller/);
    expect(bad(one({ splitDocumentsTotal: 40 }))).toBeNull();
    expect(bad(one({ splitDocuments: [null] }))).toMatch(/object/);
    expect(bad(one({ splitDocuments: [{ name: 'D', parts: [] }] }))).toMatch(/parts/);
    expect(bad(doc({}, ''))).toMatch(/name/);
    expect(bad(doc({ app: 'excel' }))).toMatch(/app/);
    expect(bad(doc({ title: '' }))).toMatch(/title/);
    expect(bad(doc({ url: 'http://www.liveplanner.app/project/p' }))).toMatch(/url/);
    expect(bad(doc({ url: 'https://evil.example/project/p' }))).toMatch(/url/);
    expect(bad(doc({ url: 'https://www.livedesign.app/design/p' }))).toMatch(/url/);
    expect(bad(one({ splitDocuments: [{ name: 'D', parts: [7] }] }))).toMatch(/object/);
    expect(
      bad({
        recipients: [
          { email: 'a@b.co', name: '' },
          { email: 'A@b.co', name: '' },
        ],
      }),
    ).toMatch(/twice/);
  });

  it('takes only https addresses on the part’s own app', () => {
    expect(isPartUrl('livediagram', 'https://livediagram.app/document/x')).toBe(true);
    expect(isPartUrl('livediagram', 'https://staging.livediagram.app/document/x')).toBe(true);
    expect(isPartUrl('livediagram', 'https://user@www.livediagram.app/document/x')).toBe(false);
    expect(isPartUrl('livediagram', 'https://www.livediagram.app:8443/x')).toBe(false);
    expect(isPartUrl('livediagram', 'not a url')).toBe(false);
    expect(isPartUrl('livediagram', 7)).toBe(false);
  });
});

describe('POST /api/auth/internal/migration-notice', () => {
  it('needs the admin token', async () => {
    const { call, sent } = setup();
    expect((await call({ recipients: [everything] }, 'wrong')).status).toBe(401);
    const unset = setup({ ADMIN_TOKEN: '' });
    expect((await unset.call({ recipients: [everything] }, '')).status).toBe(401);
    expect(sent).toHaveLength(0);
  });

  it('answers 400 with the first problem, and sends nothing', async () => {
    const { call, sent } = setup();
    const res = await call({ recipients: [{ email: 'x', name: '' }] });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: 'bad_request',
      message: 'recipients[0].email is not an email address',
    });
    expect(sent).toHaveLength(0);
  });

  it('renders without sending or claiming on a dry run, saying what a real run would skip', async () => {
    const { call, sent, addUser, sql } = setup();
    addUser('ali@example.com');
    addUser('bo@example.com');
    sql
      .prepare('INSERT INTO migration_notice (email, claimedAt) VALUES (?, 1)')
      .run('bo@example.com');
    const res = await call({
      dryRun: true,
      recipients: [
        everything,
        { email: 'bo@example.com', name: 'Bo' },
        { email: 'gone@example.com', name: '' },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.previewed).toBe(3);
    const [ali, bo, gone] = res.body.results;
    expect(ali).toMatchObject({
      email: 'ali@example.com',
      status: 'preview',
      subject: NOTICE_SUBJECT,
    });
    expect(ali!.wouldSkip).toBeUndefined();
    expect(ali!.html).toContain('Open livediagram');
    expect(ali!.text).toContain('Hi Ali,');
    expect(bo).toMatchObject({ status: 'preview', wouldSkip: 'already_sent' });
    expect(gone).toMatchObject({ status: 'preview', wouldSkip: 'no_account' });
    expect(sent).toHaveLength(0);
    expect(sql.prepare('SELECT COUNT(*) AS n FROM migration_notice').get()).toEqual({ n: 1 });
  });

  it('sends once per address from NOTICE_FROM, and a re-run skips it', async () => {
    const { call, sent, addUser, sql } = setup();
    addUser('ali@example.com');
    const first = await call({
      recipients: [
        { ...everything, email: 'Ali@Example.com' },
        { email: 'gone@example.com', name: '' },
      ],
    });
    expect(first.body).toMatchObject({ sent: 1, skipped: 1, failed: 0 });
    expect(first.body.results).toEqual([
      { email: 'ali@example.com', status: 'sent', messageId: 'm-1' },
      { email: 'gone@example.com', status: 'skipped', reason: 'no_account' },
    ]);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      from: { email: 'support@liveworkspace.app', name: 'liveworkspace' },
      to: 'ali@example.com',
      subject: NOTICE_SUBJECT,
    });
    expect(sent[0]!.text).toContain('Google Drive');
    expect(sql.prepare('SELECT * FROM migration_notice').get()).toEqual({
      email: 'ali@example.com',
      claimedAt: 1000,
      sentAt: 1000,
      messageId: 'm-1',
      error: null,
    });

    const again = await call({ recipients: [everything] });
    expect(again.body).toMatchObject({ sent: 0, skipped: 1 });
    expect(again.body.results[0]).toEqual({
      email: 'ali@example.com',
      status: 'skipped',
      reason: 'already_sent',
    });
    expect(sent).toHaveLength(1);
  });

  it('skips an address another run claimed between the read and the claim', async () => {
    const { call, sent, addUser, sql } = setup({}, async () => ({ messageId: 'm' }));
    addUser('ali@example.com');
    // A trigger stands in for a second run that claims the address just after this one reads.
    sql.exec(`CREATE TRIGGER race BEFORE INSERT ON migration_notice WHEN NEW.claimedAt = 1000
      BEGIN SELECT RAISE(IGNORE); END`);
    const res = await call({ recipients: [everything] });
    expect(res.body.results[0]).toEqual({
      email: 'ali@example.com',
      status: 'skipped',
      reason: 'already_sent',
    });
    expect(sent).toHaveLength(0);
  });

  it('releases the claim of a refused send, and keeps one that timed out', async () => {
    const refused = setup({}, async () => {
      throw new Error('E_RECIPIENT_SUPPRESSED');
    });
    refused.addUser('ali@example.com');
    const res = await refused.call({ recipients: [everything] });
    expect(res.body).toMatchObject({ sent: 0, failed: 1 });
    expect(res.body.results[0]).toMatchObject({
      status: 'failed',
      reason: 'E_RECIPIENT_SUPPRESSED',
    });
    expect(refused.sql.prepare('SELECT COUNT(*) AS n FROM migration_notice').get()).toEqual({
      n: 0,
    });

    const slow = setup({}, async () => {
      throw new Error('email send timed out after 10000 ms');
    });
    slow.addUser('ali@example.com');
    await slow.call({ recipients: [everything] });
    expect(slow.sql.prepare('SELECT email, sentAt, error FROM migration_notice').get()).toEqual({
      email: 'ali@example.com',
      sentAt: null,
      error: 'email send timed out after 10000 ms',
    });
  });

  it('refuses a real send without NOTICE_FROM, but previews', async () => {
    const { call } = setup({ NOTICE_FROM: undefined });
    expect((await call({ recipients: [everything] })).status).toBe(503);
    expect((await call({ recipients: [everything], dryRun: true })).status).toBe(200);
  });
});
