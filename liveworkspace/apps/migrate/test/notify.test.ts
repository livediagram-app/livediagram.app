// `migrate notify`: who gets the migration notice and which sections, built from a planned bundle and the snapshot,
// and how it asks the accounts Worker (a fake Http here: nothing reaches a network).
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { HttpRequest } from '../src/apply.ts';
import {
  buildRecipients,
  notify,
  NOTIFY_BATCH,
  partUrl,
  previewName,
  readBundleUsers,
  sectionCounts,
  splitStatements,
  type NotifyRecipient,
} from '../src/notify.ts';
import { DAY, NOW, put } from './fixture.ts';
import { planScenario, tempDir } from './helpers.ts';
import { CLERK, scenario } from './scenario.ts';

async function planned() {
  const snapshot = scenario();
  // Cy had Drive; Bo used an AI tool's changes with a token (the changeset route), Ali's MCP made doc-diagram.
  put(snapshot, 'drive_connections', { owner_id: 'user_cy', connected_at: NOW - 9 * DAY });
  const { outDir } = await planScenario(snapshot, { drawPicture: null });
  return { snapshot, outDir };
}

describe('splitStatements', () => {
  it('splits at semicolons outside quotes and comments', () => {
    expect(
      splitStatements(
        `-- a; comment\nPRAGMA x = 1;\nINSERT INTO "us;er" VALUES ('a;b', 'it''s;\nfine');SELECT 1`,
      ),
    ).toEqual([`PRAGMA x = 1`, `INSERT INTO "us;er" VALUES ('a;b', 'it''s;\nfine')`, 'SELECT 1']);
    expect(splitStatements('  ;  ')).toEqual([]);
    expect(splitStatements('-- only a comment')).toEqual([]);
  });
});

describe('buildRecipients', () => {
  it('reads the user rows the bundle imported', async () => {
    const { outDir } = await planned();
    const users = readBundleUsers(outDir);
    expect([...users.keys()]).toEqual(['user_ali', 'user_cy']);
    expect(users.get('user_ali')).toEqual({
      id: 'user_ali',
      email: 'ali@example.com',
      name: 'Ali Khan',
      givenName: 'Ali',
    });
  });

  it('makes one recipient per migrated account, with only the sections that apply', async () => {
    const { snapshot, outDir } = await planned();
    const { recipients, skipped } = buildRecipients({
      bundleDirs: [outDir],
      snapshot,
      env: 'production',
      now: NOW,
    });
    expect(skipped).toEqual([]);
    expect(recipients).toEqual([
      {
        email: 'ali@example.com',
        name: 'Ali',
        // Launch mixed a diagram, a deck and a board; Pitch was slides only, so it moved whole and isn't listed.
        splitDocuments: [
          {
            name: 'Launch',
            parts: expect.arrayContaining([
              {
                app: 'livedocuments',
                title: 'Deck',
                url: expect.stringMatching(/^https:\/\/www\.livedocuments\.app\/document\//),
              },
              {
                app: 'liveplanner',
                title: 'Board',
                url: expect.stringMatching(/^https:\/\/www\.liveplanner\.app\/project\//),
              },
            ]),
          },
        ],
        hasTokens: true,
        hasTeams: true,
        hasAiTool: true,
      },
      // Bo's Clerk row merged onto the account already on the new side: its address, no name without --clerk.
      { email: 'bo@example.com', name: '', hasTokens: true, hasTeams: true },
      // Cy, with the guest the old site folded in.
      { email: 'cy@example.com', name: 'Cy', hadDrive: true },
    ]);
    expect(recipients[0]!.splitDocuments![0]!.parts).toHaveLength(2);
    expect(sectionCounts(recipients)).toEqual({
      recipients: 3,
      splitDocuments: 1,
      hasTokens: 2,
      hasTeams: 2,
      hasAiTool: 1,
      hadDrive: 1,
    });
  });

  it('names a merged account from the Clerk export, and counts tokens live at the time given', async () => {
    const { snapshot, outDir } = await planned();
    const { recipients } = buildRecipients({
      bundleDirs: [outDir],
      snapshot,
      env: 'staging',
      now: NOW + 40 * DAY,
      clerkCsv: CLERK,
    });
    const bo = recipients.find((r) => r.email === 'bo@example.com')!;
    expect(bo.name).toBe('Bo');
    expect(recipients.some((r) => r.hasTokens)).toBe(false);
    const ali = recipients.find((r) => r.email === 'ali@example.com')!;
    for (const part of ali.splitDocuments![0]!.parts)
      expect(part.url).toMatch(/^https:\/\/staging\./);
  });

  it('marks an AI tool from changes made with a token, and leaves out trashed documents', async () => {
    const { snapshot, outDir } = await planned();
    snapshot.exec(`UPDATE documents SET trashed_at = ${NOW - DAY} WHERE id = 'doc-mixed'`);
    snapshot.exec('PRAGMA foreign_keys = OFF');
    put(snapshot, 'agent_changesets', {
      id: 'cs1',
      document_id: 'doc-diagram',
      tab_id: 't1',
      rev: 1,
      author_id: 'user_cy',
      author_name: 'Cy',
      author_color: '#000',
      token_id: 'tk-cy',
      fingerprints: '[]',
      added: 1,
      changed: 0,
      removed: 0,
      created_at: NOW - DAY,
    });
    const { recipients } = buildRecipients({
      bundleDirs: [outDir],
      snapshot,
      env: 'production',
      now: NOW,
    });
    expect(recipients.find((r) => r.email === 'cy@example.com')!.hasAiTool).toBe(true);
    expect(recipients.find((r) => r.email === 'ali@example.com')!.splitDocuments).toBeUndefined();
  });

  it('sends the first ten split documents and the whole count', async () => {
    const { snapshot, outDir: first } = await planned();
    // A copy whose Launch split eleven times over, as eleven documents of Ali's.
    const outDir = join(tempDir('many'), 'b');
    cpSync(first, outDir, { recursive: true });
    const movedFile = join(outDir, 'moved-parts.json');
    const [launch] = JSON.parse(readFileSync(movedFile, 'utf8')) as { oldId: string }[];
    const row = snapshot
      .prepare('SELECT * FROM documents WHERE id = ?')
      .get(launch!.oldId) as Record<string, unknown>;
    const copies = Array.from({ length: 11 }, (_, i) => ({
      ...launch!,
      oldId: `${launch!.oldId}-${i}`,
    }));
    for (const c of copies) put(snapshot, 'documents', { ...row, id: c.oldId });
    writeFileSync(movedFile, JSON.stringify(copies));
    const ali = (dirs: string[]) =>
      buildRecipients({ bundleDirs: dirs, snapshot, env: 'production', now: NOW }).recipients.find(
        (r) => r.email === 'ali@example.com',
      )!;
    expect(ali([outDir]).splitDocuments).toHaveLength(10);
    expect(ali([outDir]).splitDocumentsTotal).toBe(11);
    expect(ali([first]).splitDocumentsTotal).toBeUndefined();
  });

  it('skips an account the bundles hold no address for', async () => {
    const { snapshot, outDir: first } = await planned();
    // A copy whose owner map names an account no bundle holds a row for, and one merged onto an .invalid address.
    const outDir = join(tempDir('owners'), 'b');
    cpSync(first, outDir, { recursive: true });
    const map = JSON.parse(readFileSync(join(outDir, 'owner-map.json'), 'utf8')) as {
      accounts: Record<string, string>;
      matches: { clerkId: string; accountId: string; email: string }[];
    };
    map.accounts.user_ghost = 'user_ghost';
    map.accounts.user_bench = 'user_bench9';
    map.matches.push({ clerkId: 'user_bench', accountId: 'user_bench9', email: 'x@bench.invalid' });
    writeFileSync(join(outDir, 'owner-map.json'), JSON.stringify(map));
    // A second bundle whose own SQL carries no user rows still sees the first's.
    const { recipients, skipped } = buildRecipients({
      bundleDirs: [outDir, outDir],
      snapshot,
      env: 'production',
      now: NOW,
    });
    expect(recipients).toHaveLength(3);
    expect(skipped).toEqual([
      { account: 'user_bench9', reason: 'an .invalid address' },
      { account: 'user_ghost', reason: 'no address in the bundles' },
    ]);
    expect(() =>
      buildRecipients({ bundleDirs: [], snapshot, env: 'production', now: NOW }),
    ).toThrow(/at least one bundle/);
  });

  it('builds each part’s address in its app', () => {
    expect(partUrl('production', 'livedesign', 'd 1')).toBe(
      'https://www.livedesign.app/design/d%201',
    );
    expect(partUrl('staging', 'liveplanner', 'p')).toBe(
      'https://staging.liveplanner.app/project/p',
    );
  });
});

const bodyOf = (r: HttpRequest) =>
  JSON.parse(r.body) as { recipients: NotifyRecipient[]; dryRun?: boolean };

describe('notify', () => {
  const people = (n: number): NotifyRecipient[] =>
    Array.from({ length: n }, (_, i) => ({ email: `p${i}@example.com`, name: '' }));

  const fakeWorker = (status = 200) => {
    const requests: HttpRequest[] = [];
    return {
      requests,
      http: {
        send: async (request: HttpRequest) => {
          requests.push(request);
          const body = JSON.parse(request.body) as {
            recipients: NotifyRecipient[];
            dryRun?: boolean;
          };
          const results = body.recipients.map((r, i) =>
            body.dryRun
              ? {
                  email: r.email,
                  status: 'preview',
                  subject: 'S',
                  html: `<p>${r.email}</p>`,
                  text: r.email,
                  ...(i === 0 && { wouldSkip: 'already_sent' }),
                }
              : i === 0
                ? { email: r.email, status: 'skipped', reason: 'already_sent' }
                : i === 1
                  ? { email: r.email, status: 'failed', reason: 'E_X' }
                  : { email: r.email, status: 'sent' },
          );
          return { status, body: status === 200 ? JSON.stringify({ results }) : 'nope' };
        },
      },
    };
  };

  it('previews in batches without sending, and writes each email to the preview folder', async () => {
    const { requests, http } = fakeWorker();
    const preview = join(tempDir('notify'), 'preview');
    const lines: string[] = [];
    const summary = await notify({
      recipients: people(NOTIFY_BATCH + 3),
      env: 'staging',
      send: false,
      http,
      vars: { MIGRATE_ADMIN_TOKEN: 'secret' },
      preview,
      log: (l) => lines.push(l),
    });
    expect(summary).toEqual({ sent: 0, skipped: 0, failed: 0, previewed: NOTIFY_BATCH + 3 });
    expect(requests.map((r) => bodyOf(r).recipients.length)).toEqual([NOTIFY_BATCH, 3]);
    expect(requests[0]).toMatchObject({
      method: 'POST',
      url: 'https://staging.liveworkspace.app/api/auth/internal/migration-notice',
      headers: { authorization: 'Bearer secret' },
    });
    expect(bodyOf(requests[0]!).dryRun).toBe(true);
    expect(readFileSync(join(preview, 'p0@example.com.html'), 'utf8')).toBe(
      '<p>p0@example.com</p>',
    );
    expect(readFileSync(join(preview, 'p0@example.com.txt'), 'utf8')).toBe('p0@example.com');
    expect(lines).toContain('would skip p0@example.com: already_sent');
    expect(lines.join('\n')).not.toContain('secret');
  });

  it('sends with --send, to the origin given, and counts what the Worker answers', async () => {
    const { requests, http } = fakeWorker();
    const lines: string[] = [];
    const summary = await notify({
      recipients: people(4),
      env: 'production',
      send: true,
      http,
      vars: { MIGRATE_ADMIN_TOKEN: 't', MIGRATE_ACCOUNTS_ORIGIN: 'http://localhost:8787/' },
      log: (l) => lines.push(l),
    });
    expect(summary).toEqual({ sent: 2, skipped: 1, failed: 1, previewed: 0 });
    expect(requests[0]!.url).toBe('http://localhost:8787/api/auth/internal/migration-notice');
    expect(bodyOf(requests[0]!).dryRun).toBeUndefined();
    expect(lines).toContain('failed p1@example.com: E_X');
    expect(lines.at(-1)).toBe('2 sent, 1 skipped, 1 failed');
  });

  it('needs the admin token, and stops on an answer that isn’t 200', async () => {
    await expect(
      notify({
        recipients: people(1),
        env: 'production',
        send: false,
        http: fakeWorker().http,
        vars: {},
      }),
    ).rejects.toThrow(/MIGRATE_ADMIN_TOKEN is not set/);
    await expect(
      notify({
        recipients: people(1),
        env: 'production',
        send: true,
        http: fakeWorker(401).http,
        vars: { MIGRATE_ADMIN_TOKEN: 'secret' },
        log: () => {},
      }),
    ).rejects.toThrow(/answered 401: nope/);
  });

  it('names preview files safely', () => {
    expect(previewName('a/b..c@x.com')).toBe('a_b..c@x.com');
  });
});
