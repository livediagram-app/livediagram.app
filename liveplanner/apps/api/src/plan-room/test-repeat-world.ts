// A world for repeating cards' tests (card-repeats.test.ts, routes/item-repeat-gate.test.ts): the real worker in
// front of real PlanRooms on their own in-memory SQLite, a stand-in index that signs grants at the level a test sets,
// and helpers to make cards and read them back. Not a `.test.ts` file, so vitest does not collect it.
import { vi } from 'vitest';
import type { GrantClaims } from '@liveworkspace/index-client';
import type { Item } from '@liveplanner/items';
import { setGrantVerifierForTests } from '../index-service';
import worker from '../index';
import type { Env } from '../types';
import { planNamespace, type Plan } from './test-plan-namespace';

import { OWNER } from './test-accounts-mock';

export { OWNER };

const grantOf = (item: string, person: string, level: string) =>
  `G.${btoa(JSON.stringify({ item, sub: person, level, tab: null, team: null, exp: 9e9 }))}`;

export type RepeatWorld = {
  plans: Map<string, Plan>;
  // The level each person holds; the owner edits.
  levels: Map<string, string>;
  send: (method: string, path: string, body?: unknown, person?: string) => Promise<Response>;
  items: (planId: string) => Promise<Item[]>;
  make: (planId: string, fields: Record<string, unknown>, status?: string) => Promise<Item>;
};

export function repeatWorld(): RepeatWorld {
  setGrantVerifierForTests(async (token: string) =>
    token.startsWith('G.') ? (JSON.parse(atob(token.slice(2))) as GrantClaims) : null,
  );
  vi.stubGlobal('fetch', async () => Response.json({ ok: true }));
  const env = { INDEX_ORIGIN: 'https://index.test' } as unknown as Env;
  const { ns, plans } = planNamespace(() => env);
  Reflect.set(env, 'PLAN_ROOM', ns);
  const levels = new Map<string, string>([[OWNER, 'edit']]);
  const executionCtx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
    props: {},
  } as unknown as ExecutionContext;
  const send = (method: string, path: string, body?: unknown, person = OWNER) => {
    const planId = path.split('/')[3] ?? (body as { id?: string } | undefined)?.id ?? '';
    return worker.fetch(
      new Request(`https://api.test${path}`, {
        method,
        headers: {
          Authorization: `Bearer guest:${person}`,
          'X-Index-Grant': grantOf(planId, person, levels.get(person) ?? 'view'),
          'Content-Type': 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      env,
      executionCtx,
    );
  };
  const items = async (planId: string) =>
    (await (await send('GET', `/api/projects/${planId}/items`)).json<{ items: Item[] }>()).items;
  const make = async (planId: string, fields: Record<string, unknown>, status = 'todo') => {
    const res = await send('POST', `/api/projects/${planId}/items`, {
      type: 'task',
      fields,
      place: { status },
    });
    if (res.status !== 201) throw new Error(`create answered ${res.status}: ${await res.text()}`);
    return (await res.json<{ item: Item }>()).item;
  };
  return { plans, levels, send, items, make };
}

export async function createPlan(w: RepeatWorld, id: string): Promise<void> {
  const res = await w.send('POST', '/api/projects', {
    id,
    name: id,
    tabs: [{ id: 't1', name: 'Board', elements: [] }],
  });
  if (res.status !== 201) throw new Error(`plan create answered ${res.status}`);
}

export function endRepeatWorld(): void {
  vi.unstubAllGlobals();
  setGrantVerifierForTests(null);
}
