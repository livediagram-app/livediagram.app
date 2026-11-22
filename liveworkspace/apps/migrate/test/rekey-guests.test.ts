// rekey-guests with a fake Post: nothing here reaches a network (docs/migration.md step 6).
import { describe, expect, it } from 'vitest';
import { ADMIN_TOKEN_VAR, rekeyGuests, type Post, type RekeyBatch } from '../src/rekey-guests.ts';

function fakePost(answers: ({ status: number; body: unknown } | RekeyBatch)[]) {
  const sent: { url: string; headers: Record<string, string>; body: unknown }[] = [];
  const post: Post = async (request) => {
    sent.push({ ...request, body: JSON.parse(request.body) });
    const next = answers.shift()!;
    return 'status' in next
      ? { status: next.status, body: JSON.stringify(next.body) }
      : { status: 200, body: JSON.stringify(next) };
  };
  return { post, sent };
}

const vars = { [ADMIN_TOKEN_VAR]: 'admin' };

describe('rekey-guests', () => {
  it('asks for a dry run, prints it and changes nothing', async () => {
    const lines: string[] = [];
    const { post, sent } = fakePost([{ status: 200, body: { toRekey: 370 } }]);
    const left = await rekeyGuests({
      env: 'production',
      dryRun: true,
      vars,
      post,
      log: (l) => lines.push(l),
    });
    expect(left).toBe(0);
    expect(sent).toEqual([
      {
        url: 'https://www.liveworkspace.app/api/auth/internal/legacy-guests/rekey',
        headers: { authorization: 'Bearer admin', 'content-type': 'application/json' },
        body: { dryRun: true },
      },
    ]);
    expect(lines.join('\n')).toContain('"toRekey": 370');
  });

  it('runs batches until none are left', async () => {
    const lines: string[] = [];
    const { post, sent } = fakePost([
      { rekeyed: 25, skipped: 0, failed: 0, remaining: 26 },
      { rekeyed: 25, skipped: 0, failed: 0, remaining: 1 },
      { rekeyed: 1, skipped: 0, failed: 0, remaining: 0 },
    ]);
    const left = await rekeyGuests({
      env: 'staging',
      dryRun: false,
      vars,
      post,
      log: (l) => lines.push(l),
    });
    expect(left).toBe(0);
    expect(sent.map((s) => [s.url, s.body])).toEqual(
      Array(3).fill([
        'https://staging.liveworkspace.app/api/auth/internal/legacy-guests/rekey',
        { limit: 25 },
      ]),
    );
    expect(lines.at(-1)).toBe('{"rekeyed":51,"skipped":0,"failed":0,"remaining":0}');
  });

  it('stops when a batch moves none, and says how many are left', async () => {
    const lines: string[] = [];
    const { post, sent } = fakePost([
      { rekeyed: 3, skipped: 0, failed: 0, remaining: 2 },
      { rekeyed: 0, skipped: 1, failed: 1, remaining: 2 },
    ]);
    expect(
      await rekeyGuests({
        env: 'production',
        dryRun: false,
        vars,
        post,
        log: (l) => lines.push(l),
      }),
    ).toBe(2);
    expect(sent).toHaveLength(2);
    expect(lines.at(-1)).toContain('2 left: run it again');
  });

  it('needs the admin token, and stops on any answer but 200', async () => {
    const { post } = fakePost([{ status: 404, body: { error: 'not_found' } }]);
    const log = () => {};
    await expect(
      rekeyGuests({ env: 'production', dryRun: true, vars: {}, post, log }),
    ).rejects.toThrow(ADMIN_TOKEN_VAR);
    await expect(rekeyGuests({ env: 'production', dryRun: true, vars, post, log })).rejects.toThrow(
      'rekey-guests production: 404 {"error":"not_found"}',
    );
  });
});
