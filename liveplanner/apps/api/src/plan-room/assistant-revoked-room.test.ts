import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrantClaims } from '@liveworkspace/index-client';
import { itemAssistantFor, itemPersonId } from '@liveplanner/items';
import { setGrantVerifierForTests } from '../index-service';
import worker from '../index';
import type { Env } from '../types';
import { planNamespace, type Plan } from './test-plan-namespace';

// The index's door for a revoked AI tool, end to end (docs/specs/026-plan/items.md "When its token is revoked", Work
// Tracker 1294): the real worker answers POST /api/internal/people/:id/assistant-revoked on the index's key and asks
// each plan's own Durable Object, which forgets the tool and hands its cards back; a plan never started stays empty.

vi.mock('../auth/accounts', () => ({
  getPersonIdentity: async () => ({ kind: 'guest', guestId: 'guest_owner' }),
  accountCredentials: () => null,
}));

const grantOf = (item: string) =>
  `G.${btoa(JSON.stringify({ item, sub: 'guest_owner', level: 'edit', tab: null, team: null, exp: 9e9 }))}`;

beforeEach(() => {
  setGrantVerifierForTests(async (token: string) =>
    token.startsWith('G.') ? (JSON.parse(atob(token.slice(2))) as GrantClaims) : null,
  );
  vi.stubGlobal('fetch', async () => Response.json({ ok: true }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setGrantVerifierForTests(null);
});

function world() {
  const env = { INDEX_ORIGIN: 'https://index.test', INDEX_KEY: 'index-key' } as unknown as Env;
  const { ns, plans } = planNamespace(() => env);
  Reflect.set(env, 'PLAN_ROOM', ns);
  const ctx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} };
  const send = (method: string, path: string, body: unknown, headers: Record<string, string>) =>
    worker.fetch(
      new Request(`https://api.test${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      }),
      env,
      ctx as unknown as ExecutionContext,
    );
  return { plans, send };
}

describe('POST /api/internal/people/:id/assistant-revoked', () => {
  it("hands the tool's cards back in each plan's own storage, and starts no plan", async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const w = world();
    const made = await w.send(
      'POST',
      '/api/projects',
      { id: 'A', name: 'A', tabs: [{ id: 't1', name: 'Board', elements: [] }] },
      { Authorization: 'Bearer guest-token', 'X-Index-Grant': grantOf('A') },
    );
    expect(made.status).toBe(201);
    const plan: Plan = w.plans.get('A')!;
    const erin = { id: await itemPersonId('user_erin'), name: 'Erin', color: '#16a34a' };
    const claude = itemAssistantFor(erin, 'Claude')!;
    plan.db
      .prepare(
        `INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
         VALUES ('A', 'card-1', 'task', 1, 'i', ?, 1, 0, 0, '{}', '{}')`,
      )
      .run(JSON.stringify({ title: 'Fix login', assignee: claude }));
    plan.db
      .prepare(
        `INSERT INTO known_assistants (id, client, person_id, person, seen_at) VALUES (?, 'Claude', ?, ?, 1)`,
      )
      .run(claude.id, erin.id, JSON.stringify(erin));

    const res = await w.send(
      'POST',
      '/api/internal/people/user_erin/assistant-revoked',
      { client: 'Claude', items: ['A', 'Z'] },
      { Authorization: 'Bearer index-key' },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, reached: 2, unreached: [] });
    const fields = JSON.parse(
      String(plan.db.prepare('SELECT fields FROM items').get()!.fields),
    ) as {
      assignee: unknown;
    };
    expect(fields.assignee).toEqual(erin);
    expect(plan.db.prepare('SELECT COUNT(*) AS n FROM known_assistants').get()!.n).toBe(0);
    const z = w.plans.get('Z');
    expect(
      z ? z.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").get()!.n : 0,
    ).toBe(0);
  });
});
