import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { endRepeatWorld } from '../plan-room/test-repeat-world';
import { PlanRoom } from '../plan-room/plan-room';
import { readConnection } from '../plan-room/github/github-store';
import { githubConfig, WEBHOOK_BODY_MAX } from './github-config';
import {
  connection,
  githubEnv,
  githubWorld,
  fakeKv,
  sign,
  type GithubWorld,
} from './test-github-world';

// The webhook receiver (docs/specs/026-plan/github-pull-requests.md "Deliveries", "The App"; blueprint "Part 2"),
// through the real worker and the plans' rooms: off while any setting is missing; the signature checked on the raw
// bytes before anything parses them; the body capped; each delivery reaching only plans whose connection names it,
// once.
vi.mock(
  '../auth/accounts',
  async () => (await import('../plan-room/test-accounts-mock')).accountsMock,
);

let w: GithubWorld;
let logged: string[];
beforeEach(async () => {
  logged = [];
  for (const level of ['info', 'warn', 'log', 'error', 'debug'] as const)
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(`${level} ${JSON.stringify(args)}`);
    });
  w = await githubWorld(['A', 'B']);
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const pr = (repoId: number, installationId = 7) => ({
  action: 'opened',
  installation: { id: installationId },
  repository: { id: repoId },
  pull_request: { number: 42, title: 'Private title' },
});

describe('off', () => {
  it('needs every secret and the namespace; missing any one, every door answers 404 and nothing is logged', async () => {
    const full = githubEnv(fakeKv().kv);
    expect(githubConfig(full)).not.toBeNull();
    for (const key of Object.keys(full) as (keyof typeof full)[]) {
      expect(githubConfig({ ...full, [key]: undefined }), key).toBeNull();
      expect(
        githubConfig({ ...full, [key]: key === 'GITHUB_LINKS' ? undefined : '  ' }),
        key,
      ).toBeNull();
    }
    for (const key of Object.keys(full)) Reflect.deleteProperty(w.env, key);
    for (const id of ['A', 'B']) w.plans.get(id)!.restart();
    logged = [];
    const body = JSON.stringify(pr(11));
    const answers = await Promise.all([
      w.deliver('pull_request', pr(11)),
      w.raw(
        new Request('https://api.test/api/github/webhook', {
          method: 'POST',
          body,
          headers: { 'X-Hub-Signature-256': sign(body) },
        }),
      ),
      w.raw(new Request('https://api.test/api/github/callback?state=x')),
      w.as('owner', 'GET', '/github'),
      w.as('owner', 'POST', '/github/connect'),
      w.as('owner', 'PUT', '/github/repositories', { ids: [] }),
      w.as('owner', 'DELETE', '/github'),
    ]);
    expect(answers.map((r) => r.status)).toEqual([404, 404, 404, 404, 404, 404, 404]);
    expect(logged.filter((l) => l.startsWith('error') || l.startsWith('warn'))).toEqual([]);
    expect(logged.filter((l) => l.includes('[github]'))).toEqual([]);
    const caps = await (
      await w.raw(new Request('https://api.test/api/capabilities'))
    ).json<{ githubEnabled: boolean }>();
    expect(caps.githubEnabled).toBe(false);
  });

  it('is on with them all, and the capabilities say so', async () => {
    const caps = await (
      await w.raw(new Request('https://api.test/api/capabilities'))
    ).json<{ githubEnabled: boolean }>();
    expect(caps.githubEnabled).toBe(true);
  });
});

describe('the signature', () => {
  it('is checked before the body is parsed: a wrong, missing or malformed one is 401, the body never read as JSON', async () => {
    await w.seed('A', connection(7, [{ id: 11 }]));
    const parse = vi.spyOn(JSON, 'parse');
    const body = '{"not json';
    for (const signature of [
      null,
      sign(body, 'another-secret'),
      'sha1=abc',
      'sha256=',
      `sha256=${'z'.repeat(64)}`,
      `${sign(body)}00`,
    ]) {
      const res = await w.deliver('pull_request', null, { body, signature });
      expect(res.status, String(signature)).toBe(401);
      expect(await res.json()).toEqual({ error: 'github_signature_invalid' });
    }
    expect(parse.mock.calls.filter(([text]) => text === body)).toEqual([]);
    // Signed right, the same body is read, and refused as JSON it is not.
    expect((await w.deliver('pull_request', null, { body })).status).toBe(400);
  });

  it('accepts the signature in upper case hex', async () => {
    const body = JSON.stringify({ zen: 'Keep it logically awesome.' });
    const res = await w.deliver('ping', null, {
      body,
      signature: sign(body).toUpperCase().replace('SHA256=', 'sha256='),
    });
    expect(res.status).toBe(200);
  });

  it('a GET is 405, not read', async () => {
    expect((await w.raw(new Request('https://api.test/api/github/webhook'))).status).toBe(405);
    expect((await w.raw(new Request('https://api.test/api/github/elsewhere'))).status).toBe(404);
  });
});

describe('the body', () => {
  it('over 1 MB is refused, declared or read, before the signature is worked out', async () => {
    const big = 'x'.repeat(WEBHOOK_BODY_MAX + 1);
    const declared = await w.raw(
      new Request('https://api.test/api/github/webhook', {
        method: 'POST',
        headers: {
          'Content-Length': String(WEBHOOK_BODY_MAX + 1),
          'X-Hub-Signature-256': sign(big),
        },
        body: big,
      }),
    );
    expect(declared.status).toBe(413);
    // No length declared (a chunked body): counted as it is read.
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        const chunk = new TextEncoder().encode('x'.repeat(256 * 1024));
        for (let i = 0; i < 5; i += 1) c.enqueue(chunk);
        c.close();
      },
    });
    const streamed = await w.raw(
      new Request('https://api.test/api/github/webhook', {
        method: 'POST',
        headers: { 'X-Hub-Signature-256': sign(big) },
        body: stream,
        duplex: 'half',
      } as RequestInit),
    );
    expect(streamed.status).toBe(413);
    expect(await streamed.json()).toEqual({ error: 'github_too_large' });
  });

  it('needs a delivery id', async () => {
    const res = await w.deliver('pull_request', pr(11), { id: 'not a guid!' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'github_delivery_invalid' });
  });
});

describe('a delivery', () => {
  it('ping is answered and nothing more', async () => {
    const res = await w.deliver('ping', { zen: 'Design for failure.', hook_id: 1 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('reaches only plans whose connection names its installation and a chosen repository', async () => {
    await w.seed('A', connection(7, [{ id: 11 }]));
    // B lists repository 11 in the index, but its connection is another installation's: a stale or forged entry.
    await w.seed('B', connection(8, [{ id: 11 }]));
    const github = vi.spyOn(PlanRoom.prototype, 'github');
    const res = await w.deliver('pull_request', pr(11));
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ delivered: 1 });
    expect(github).toHaveBeenCalledTimes(2);
    // B disowned its key.
    expect(w.kv.keys()).toEqual(['installation:7:A', 'installation:8:B', 'repo:11:A']);
    // A repository nobody connects reaches nobody.
    expect(await (await w.deliver('check_suite', pr(99))).json()).toEqual({ delivered: 0 });
  });

  it('a repository listed but not chosen reaches nothing', async () => {
    await w.seed('A', connection(7, [{ id: 11, chosen: false }]));
    await w.kv.kv.put('repo:11:A', '');
    expect(await (await w.deliver('pull_request', pr(11))).json()).toEqual({ delivered: 0 });
    expect(w.kv.keys()).toEqual(['installation:7:A']);
  });

  it('is acted on once: a replay of its id is ignored', async () => {
    await w.seed('A', connection(7, [{ id: 11 }]));
    const id = '72d3162e-cc78-11e3-81ab-4c9367dc0958';
    expect(await (await w.deliver('pull_request', pr(11), { id })).json()).toEqual({
      delivered: 1,
    });
    expect(await (await w.deliver('pull_request', pr(11), { id })).json()).toEqual({
      delivered: 0,
    });
    expect(logged.some((l) => l.includes('"replayed":1'))).toBe(true);
  });

  it('forgets an id after 3 days', async () => {
    await w.seed('A', connection(7, [{ id: 11 }]));
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    expect(await (await w.deliver('pull_request', pr(11), { id: 'abc' })).json()).toEqual({
      delivered: 1,
    });
    vi.spyOn(Date, 'now').mockReturnValue(now + 3 * 24 * 60 * 60 * 1000 + 1);
    expect(await (await w.deliver('pull_request', pr(11), { id: 'abc' })).json()).toEqual({
      delivered: 1,
    });
  });

  it('of repositories removed from the installation drops them from every plan', async () => {
    await w.seed('A', connection(7, [{ id: 11 }, { id: 12 }]));
    await w.seed('B', connection(7, [{ id: 11 }]));
    const res = await w.deliver('installation_repositories', {
      action: 'removed',
      installation: { id: 7 },
      repositories_removed: [{ id: 11 }, { id: 'x' }],
    });
    expect(await res.json()).toEqual({ delivered: 2 });
    const a = await readConnection(w.planEnv('A').PLAN_DB, 'A');
    expect(a!.repositories.map((r) => r.id)).toEqual([12]);
    expect(w.kv.keys()).toEqual(['installation:7:A', 'installation:7:B', 'repo:12:A']);
  });

  it('of the App uninstalled drops every plan’s connection to it', async () => {
    await w.seed('A', connection(7, [{ id: 11 }]));
    await w.seed('B', connection(8, [{ id: 21 }]));
    const res = await w.deliver('installation', { action: 'deleted', installation: { id: 7 } });
    expect(await res.json()).toEqual({ delivered: 1 });
    expect(await readConnection(w.planEnv('A').PLAN_DB, 'A')).toBeNull();
    expect(await readConnection(w.planEnv('B').PLAN_DB, 'B')).not.toBeNull();
    expect(w.kv.keys()).toEqual(['installation:8:B', 'repo:21:B']);
  });

  it('of an event or action this part does nothing with is accepted and ignored', async () => {
    await w.seed('A', connection(7, [{ id: 11 }]));
    for (const [event, payload] of [
      ['issues', pr(11)],
      ['installation', { action: 'created', installation: { id: 7 } }],
      [
        'installation_repositories',
        { action: 'added', installation: { id: 7 }, repositories_added: [] },
      ],
      ['pull_request', { action: 'opened', repository: { id: 11 } }],
    ] as const) {
      const res = await w.deliver(event, payload);
      expect(res.status, event).toBe(202);
      expect(await res.json()).toEqual({ delivered: 0 });
    }
    expect(await readConnection(w.planEnv('A').PLAN_DB, 'A')).not.toBeNull();
  });

  it('answers 502 when a plan fails, so GitHub redelivers', async () => {
    await w.seed('A', connection(7, [{ id: 11 }]));
    vi.spyOn(PlanRoom.prototype, 'github').mockRejectedValueOnce(new Error('room down'));
    const res = await w.deliver('pull_request', pr(11));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'github_delivery_failed' });
  });

  it('a plan nothing has written answers not connected and stays empty', async () => {
    await w.kv.kv.put('repo:11:ghost', '');
    expect(await (await w.deliver('pull_request', pr(11))).json()).toEqual({ delivered: 0 });
    expect(w.plans.get('ghost')!.room.storedSchema()).toBe(false);
    expect(w.kv.keys()).toEqual([]);
  });

  it('never logs the body or the signature', async () => {
    await w.seed('A', connection(7, [{ id: 11 }]));
    const body = JSON.stringify(pr(11));
    await w.deliver('pull_request', null, { body });
    const text = logged.join('\n');
    expect(text).not.toContain('Private title');
    expect(text).not.toContain(sign(body).slice(7));
    expect(text).not.toContain('whsec');
  });
});
