// Tests only, in node: an app's real room on workerd, driven over HTTP (blueprint item-engine.md "Tests": the
// workerd harness). `startTestWorker` runs the app's test Worker (its `worker.ts` and `wrangler.toml`, built on
// `worker.ts` here) through wrangler's `unstable_dev`, handed in so this package needs no wrangler of its own;
// `itemDriver` is one item's room as a test drives it.
import { createHmac } from 'node:crypto';
import { createServer } from 'node:net';
import type { ItemEvent, ItemRuleBody } from '../item';
import { testRuleBody } from './room-world';

// A port nothing holds now (`pinned`, an app's WORKERD_TEST_PORT, is taken instead: for a machine with port blocks).
export async function freePort(pinned?: number): Promise<number> {
  if (pinned) return pinned;
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

// What wrangler's `unstable_dev` answers, as far as the harness uses it.
export interface TestWorker {
  fetch(
    path: string,
    init: { method: string; headers: Record<string, string>; body: string },
  ): Promise<{ ok: boolean; status: number; text(): Promise<string>; json(): Promise<unknown> }>;
  stop(): Promise<void>;
}

type UnstableDev = (script: string, options: Record<string, unknown>) => Promise<unknown>;

/** The app's test Worker, started with nothing persisted and off the machine-wide dev registry. */
export async function startTestWorker(
  unstableDev: UnstableDev,
  files: { worker: string; config: string; port?: number },
): Promise<TestWorker> {
  return (await unstableDev(files.worker, {
    config: files.config,
    ip: '127.0.0.1',
    port: await freePort(files.port),
    logLevel: 'none',
    // Nothing kept between runs: every run starts with no Durable Object stored.
    persist: false,
    // Off the machine-wide dev registry, so no other local Worker sees this one or it them.
    experimental: { disableExperimentalWarning: true, disableDevRegistry: true },
  })) as TestWorker;
}

/** POST `body` to the test Worker's `path`; throws on anything but a 2xx. */
export async function askWorker<T>(worker: TestWorker, path: string, body: unknown): Promise<T> {
  const res = await worker.fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} answered ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

// The timestamp every signed call of a run carries (unix seconds), well inside the five minutes a call may be off.
export const HOOK_TIMESTAMP = String(Math.floor(Date.now() / 1000));

/** An Incoming Webhook call's signature header for `body` under `secret`, signed as a sender signs: the timestamp
 *  (HOOK_TIMESTAMP, which `hook` sends beside it), a dot and the exact body. */
export const signHook = (secret: string, body: string): string =>
  `sha256=${createHmac('sha256', secret).update(`${HOOK_TIMESTAMP}.${body}`).digest('hex')}`;

export interface ItemDriverInput {
  worker: () => TestWorker;
  // The item's id, which also names its room.
  name: string;
  // The item's path under the api: `/api/documents/<name>`.
  base: string;
  // The caller as the app's Worker would have resolved them.
  identity: unknown;
}

/** One item's room, by name. */
export function itemDriver(input: ItemDriverInput) {
  const { name, base } = input;
  const post = <T>(path: string, body: Record<string, unknown>) =>
    askWorker<T>(input.worker(), path, { name, ...body });
  const drive = async <T = unknown>(method: string, path: string, body?: unknown) => {
    const { status, text } = await post<{ status: number; text: string }>('/drive', {
      call: { method, path, body, identity: input.identity },
    });
    return { status, body: (text ? JSON.parse(text) : null) as T };
  };
  const rows = async <T = Record<string, unknown>>(query: string, bindings: unknown[] = []) =>
    (await post<{ rows: T[] }>('/rows', { query, bindings })).rows;
  return {
    name,
    base,
    drive,
    rows,
    /** A rule saved through the routes; throws unless it answers 201. */
    rule: async (body: Partial<ItemRuleBody>) => {
      const made = await drive<{ rule: { id: string; stats: { nextAt: number | null } } }>(
        'POST',
        `${base}/automations`,
        testRuleBody(body),
      );
      if (made.status !== 201)
        throw new Error(`rule answered ${made.status}: ${JSON.stringify(made.body)}`);
      return made.body.rule;
    },
    /** Run Rule: a Run by Hand rule, now. */
    run: (ruleId: string, body: Record<string, unknown> = {}) =>
      drive<{ run: { result: string; steps: { text: string; ok?: boolean }[] } }>(
        'POST',
        `${base}/automations/${ruleId}/run`,
        body,
      ),
    /** The alarm's share for Automations, as though it rang at `now`. */
    automationsAt: (now: number) => post('/automations', { now }),
    wakeAt: async () => (await post<{ at: number | null }>('/wake', {})).at,
    hook: (
      ruleId: string,
      hook: {
        body: string;
        authorization: string | null;
        signature: string | null;
        timestamp?: string | null;
      },
    ) =>
      post<{ status: number; body: Record<string, unknown> }>('/hook', {
        ruleId,
        hook: { timestamp: HOOK_TIMESTAMP, ...hook },
      }),
    queued: async () =>
      (await rows<{ event: string }>('SELECT event FROM automation_queue ORDER BY id')).map(
        (r) => JSON.parse(r.event) as ItemEvent,
      ),
    runs: async () =>
      (
        await rows<{ result: string; body: string }>(
          'SELECT result, body FROM automation_runs ORDER BY at, id',
        )
      ).map((r) => ({ ...(JSON.parse(r.body) as { ruleId: string }), result: r.result })),
  };
}

export type ItemDriver = ReturnType<typeof itemDriver>;
