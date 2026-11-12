import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { endRepeatWorld } from '../plan-room/test-repeat-world';
import { PlanRoom } from '../plan-room/plan-room';
import { readConnection } from '../plan-room/github/github-store';
import {
  githubConfig,
  REFUSED_NETWORK_TURNED_AWAY_MS,
  REFUSED_NETWORKS_KEPT,
  WEBHOOK_BODY_MAX,
} from './github-config';
import {
  countRefusal,
  isGithubHookAddress,
  isTurnedAway,
  turnedAwayCount,
} from './refused-signatures';
import { webhookSignatureOk } from './webhook-signature';
import {
  connection,
  githubEnv,
  githubWorld,
  fakeKv,
  prPayload,
  sign,
  suitePayload,
  WEBHOOK_SECRET,
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

const pr = (repoId: number, installationId = 7) => prPayload({ repoId, installationId });

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

  it('reads a missing or malformed header as no signature, whoever asks', async () => {
    const body = new TextEncoder().encode('{}');
    expect(await webhookSignatureOk(WEBHOOK_SECRET, body, null)).toBe(false);
    expect(await webhookSignatureOk(WEBHOOK_SECRET, body, 'sha256=12')).toBe(false);
    expect(await webhookSignatureOk(WEBHOOK_SECRET, body, sign('{}'))).toBe(true);
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
    expect(await (await w.deliver('check_suite', suitePayload({ repoId: 99 }))).json()).toEqual({
      delivered: 0,
    });
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

describe('refused signatures', () => {
  // A stand-in write limiter: each key allowed `allowed` calls, every call recorded.
  let calls: string[];
  let allowed: number;
  beforeEach(() => {
    calls = [];
    allowed = 3;
    Object.assign(w.env, {
      WRITE_RATE_LIMITER: {
        limit: async ({ key }: { key: string }) => {
          calls.push(key);
          return { success: calls.filter((k) => k === key).length <= allowed };
        },
      },
    });
  });

  // A body that counts the reads it is asked for: zero means it was never read.
  const countedBody = (text: string) => {
    const reads = { count: 0 };
    const stream = new ReadableStream<Uint8Array>(
      {
        pull(c) {
          reads.count += 1;
          c.enqueue(new TextEncoder().encode(text));
          c.close();
        },
      },
      { highWaterMark: 0 },
    );
    return { stream, reads };
  };

  const post = (ip: string, signature: string | null, body: BodyInit = '{}') =>
    w.raw(
      new Request('https://api.test/api/github/webhook', {
        method: 'POST',
        headers: {
          'CF-Connecting-IP': ip,
          'X-GitHub-Event': 'ping',
          'X-GitHub-Delivery': crypto.randomUUID(),
          ...(signature === null ? {} : { 'X-Hub-Signature-256': signature }),
        },
        body,
        duplex: 'half',
      } as RequestInit),
    );

  it('counts only refusals, per network, and turns one over its limit away before its body is read', async () => {
    const wrong = sign('{}', 'another-secret');
    for (let i = 0; i < 3; i += 1) expect((await post('203.0.113.7', wrong)).status).toBe(401);
    const over = await post('203.0.113.8', wrong);
    expect(over.status).toBe(429);
    expect(over.headers.get('Retry-After')).toBe('60');
    expect(await over.json()).toEqual({ error: 'github_rate_limited' });
    expect(calls).toEqual(Array(4).fill('github-refused:203.0.113.0/24'));
    // Turned away: even a delivery that signs right, its body never read, the limiter not asked again.
    const { stream, reads } = countedBody('{}');
    expect((await post('203.0.113.9', sign('{}'), stream)).status).toBe(429);
    expect(reads.count).toBe(0);
    expect(calls).toHaveLength(4);
    // Another network is not touched, and a delivery that signs right is never counted.
    expect((await post('198.51.100.1', sign('{}'))).status).toBe(200);
    expect(calls).toHaveLength(4);
    // A minute on, the network may come back.
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + REFUSED_NETWORK_TURNED_AWAY_MS + 1);
    expect((await post('203.0.113.7', sign('{}'))).status).toBe(200);
  });

  it('refuses a missing or malformed signature before a byte of the body is read', async () => {
    for (const signature of [null, 'sha1=abc', `sha256=${'z'.repeat(64)}`]) {
      const { stream, reads } = countedBody('{}');
      const res = await post('198.51.100.20', signature, stream);
      expect(res.status, String(signature)).toBe(401);
      expect(reads.count).toBe(0);
    }
    expect(calls).toEqual(Array(3).fill('github-refused:198.51.100.0/24'));
  });

  it('keys IPv6 on the /56', async () => {
    await post('2001:db8:1234:5601::1', null);
    await post('2001:db8:1234:56ff::2', null);
    expect(calls).toEqual(Array(2).fill('github-refused:2001:0db8:1234:5600::/56'));
  });

  it('never limits GitHub’s own addresses, or anyone when the limiter is not bound', async () => {
    allowed = 0;
    for (const ip of ['140.82.115.1', '192.30.252.200', '2606:50c0:8000::1', '::ffff:143.55.64.9'])
      for (let i = 0; i < 3; i += 1) expect((await post(ip, null)).status, ip).toBe(401);
    expect(calls).toEqual([]);
    Reflect.deleteProperty(w.env, 'WRITE_RATE_LIMITER');
    for (let i = 0; i < 5; i += 1) expect((await post('198.51.100.40', null)).status).toBe(401);
  });

  it('knows GitHub’s webhook ranges and nothing else', () => {
    const inside = ['192.30.252.1', '185.199.111.255', '140.82.127.0', '143.55.79.255'];
    const v6Inside = ['2a0a:a440::1', '2a0a:a447:ffff::1', '2606:50c0::', '::ffff:192.30.253.4'];
    for (const ip of [...inside, ...v6Inside]) expect(isGithubHookAddress(ip), ip).toBe(true);
    const outside = ['192.30.251.255', '185.199.112.0', '140.82.128.1', '143.55.80.0', '8.8.8.8'];
    const odd = ['2a0a:a448::1', '2606:50c1::1', 'anonymous', '1.2.3', '1.2.3.x', '1.2.3.1234'];
    for (const ip of [...outside, ...odd, '1.2.3.256', '1..2.3']) {
      expect(isGithubHookAddress(ip), ip).toBe(false);
    }
  });

  it('remembers at most 1,000 networks turned away, the oldest going first', async () => {
    allowed = 0;
    const env = w.env;
    const now = Date.now();
    for (let i = 0; i <= REFUSED_NETWORKS_KEPT; i += 1)
      expect(await countRefusal(env, `net-${i}`, now)).toBe(true);
    expect(turnedAwayCount()).toBe(REFUSED_NETWORKS_KEPT);
    expect(isTurnedAway('net-0', now)).toBe(false);
    expect(isTurnedAway(`net-${REFUSED_NETWORKS_KEPT}`, now)).toBe(true);
    // Turned away again, a network moves to the newest.
    expect(await countRefusal(env, 'net-1', now)).toBe(true);
    expect(await countRefusal(env, 'net-new', now)).toBe(true);
    expect(isTurnedAway('net-1', now)).toBe(true);
    expect(isTurnedAway('net-2', now)).toBe(false);
  });
});
