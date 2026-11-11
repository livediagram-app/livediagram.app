import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/core', () => ({
  API_BASE: '/api',
  apiFetch: vi.fn(),
  apiHeaders: vi.fn(async () => ({ Authorization: 'Bearer t' })),
  expectOk: vi.fn(async (res: Response) => {
    if (!res.ok) throw new Error(`failed ${res.status}`);
    return (await res.json()) as unknown;
  }),
  expectOkVoid: vi.fn(async () => {}),
}));

import { apiFetch } from '@/lib/api/core';
import {
  AutomationRefusal,
  createRule,
  deleteRule,
  duplicateRule,
  listAutomations,
  listRuns,
  runRule,
  testRule,
  toggleRule,
  updateRule,
} from './automations-client';
import { newRuleBody } from './rule-draft';

// The automations routes (docs/specs/026-plan/blueprints/automations.md "Routes"): each call's path, method and body,
// and a refusal read from the answer's body so the builder can mark the part it names.
const SCOPE = { ownerId: 'me', projectId: 'p 1', shareCode: null };
const body = newRuleBody('R', 'UTC');
const fetched = vi.mocked(apiFetch);

beforeEach(() => {
  fetched.mockReset();
  fetched.mockImplementation(async () => Response.json({ ok: true }));
});

const calls = () =>
  fetched.mock.calls.map(([u, init]) =>
    `${String(init?.method)} ${String(u)} ${typeof init?.body === 'string' ? init.body : ''}`.trim(),
  );

describe('automations-client', () => {
  it('calls each route', async () => {
    await listAutomations(SCOPE);
    await createRule(SCOPE, body);
    await updateRule(SCOPE, 'r/1', body);
    await toggleRule(SCOPE, 'r1', false);
    await duplicateRule(SCOPE, 'r1');
    await testRule(SCOPE, body, 'i1');
    await runRule(SCOPE, 'r1', 'i1');
    await listRuns(SCOPE);
    await listRuns(SCOPE, { rule: 'r1', result: 'failed', since: 5, limit: 200 });
    const json = JSON.stringify(body);
    expect(calls()).toEqual([
      'GET /api/projects/p%201/automations',
      `POST /api/projects/p%201/automations ${json}`,
      `PUT /api/projects/p%201/automations/r%2F1 ${json}`,
      'POST /api/projects/p%201/automations/r1/toggle {"enabled":false}',
      'POST /api/projects/p%201/automations/r1/duplicate',
      `POST /api/projects/p%201/automations/test {"rule":${json},"item":"i1"}`,
      'POST /api/projects/p%201/automations/r1/run {"item":"i1"}',
      'GET /api/projects/p%201/automations/runs',
      'GET /api/projects/p%201/automations/runs?rule=r1&result=failed&since=5&limit=200',
    ]);
  });

  it('answers a delete’s 204 with nothing', async () => {
    fetched.mockImplementation(async () => new Response(null, { status: 204 }));
    expect(await deleteRule(SCOPE, 'r1')).toBeUndefined();
  });

  it('throws a refusal with its code and path, and anything else as the api failure', async () => {
    fetched.mockImplementation(async () =>
      Response.json(
        { error: 'automation_invalid', path: 'steps.2.text', message: 'Too long.' },
        { status: 400 },
      ),
    );
    const refusal = await createRule(SCOPE, body).catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(AutomationRefusal);
    expect(refusal).toMatchObject({
      status: 400,
      code: 'automation_invalid',
      path: 'steps.2.text',
      message: 'Too long.',
    });
    fetched.mockImplementation(async () =>
      Response.json({ error: 'automations_need_editor' }, { status: 403 }),
    );
    expect(await listAutomations(SCOPE).catch((e: unknown) => e)).toMatchObject({
      path: null,
      message: 'automations_need_editor',
    });
    fetched.mockImplementation(async () => Response.json({ error: 'other' }, { status: 500 }));
    expect(await listAutomations(SCOPE).catch((e: unknown) => e)).not.toBeInstanceOf(
      AutomationRefusal,
    );
    fetched.mockImplementation(async () => new Response('not json', { status: 502 }));
    expect(await listAutomations(SCOPE).catch((e: unknown) => String(e))).toContain('failed 502');
  });
});
