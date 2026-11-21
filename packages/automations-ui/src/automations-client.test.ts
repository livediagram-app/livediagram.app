// The routes (blueprint ui.md "The client"): each call's method, address and body over the app's own fetch, a
// refusal the api names thrown as an answer, and anything else left to the app's reading of it.
import { describe, expect, it, vi } from 'vitest';
import {
  AutomationRefusal,
  createAutomationsClient,
  type AutomationsApi,
} from './automations-client';

const SCOPE = { ownerId: 'o1', itemId: 'i 1', shareCode: 'abc' };

function setup(answer: () => Response = () => Response.json({ ok: true })) {
  const fetch = vi.fn(async (_url: string, _init: RequestInit) => answer());
  const api: AutomationsApi = {
    url: (scope) => `/api/items/${encodeURIComponent(scope.itemId)}/automations`,
    fetch,
    headers: async (scope, body) => ({ 'x-owner': scope.ownerId, 'x-body': String(body) }),
    expectOk: async <T>(res: Response) => {
      if (!res.ok) throw new Error(`status ${res.status}`);
      return (await res.json()) as T;
    },
    expectOkVoid: vi.fn(async () => {}),
    errors: ['automation_invalid', 'automations_need_editor'],
    subject: (subject) => ({ tab: subject }),
  };
  return { client: createAutomationsClient(api), fetch, api };
}
const sent = (fetch: ReturnType<typeof setup>['fetch'], n = 0) => {
  const [url, init] = fetch.mock.calls[n]!;
  return {
    url,
    method: init.method,
    body: init.body ? (JSON.parse(init.body as string) as unknown) : undefined,
    headers: init.headers,
  };
};

describe('the Automations client', () => {
  it('calls each route with its method, address and body', async () => {
    const { client, fetch } = setup();
    const rule = {
      name: 'R',
      trigger: { kind: 't' },
      conditions: [],
      steps: [],
      chain: false,
      timeZone: 'UTC',
    };
    await client.list(SCOPE);
    await client.create(SCOPE, rule);
    await client.update(SCOPE, 'r/1', rule);
    await client.toggle(SCOPE, 'r1', true);
    await client.duplicate(SCOPE, 'r1');
    await client.test(SCOPE, rule, 't1');
    await client.draft(SCOPE, 'every night', 'Europe/London');
    await client.run(SCOPE, 'r1', null);
    await client.makeSecret(SCOPE, 'r1');
    const base = '/api/items/i%201/automations';
    expect(
      fetch.mock.calls.map((_, i) => sent(fetch, i)).map((c) => [c.method, c.url, c.body]),
    ).toEqual([
      ['GET', base, undefined],
      ['POST', base, rule],
      ['PUT', `${base}/r%2F1`, rule],
      ['POST', `${base}/r1/toggle`, { enabled: true }],
      ['POST', `${base}/r1/duplicate`, undefined],
      ['POST', `${base}/test`, { rule, tab: 't1' }],
      ['POST', `${base}/draft`, { prompt: 'every night', timeZone: 'Europe/London' }],
      ['POST', `${base}/r1/run`, { tab: null }],
      ['POST', `${base}/r1/secret`, undefined],
    ]);
    // The app's headers, told whether a body rides along.
    expect(sent(fetch, 0).headers).toEqual({ 'x-owner': 'o1', 'x-body': 'false' });
    expect(sent(fetch, 1).headers).toEqual({ 'x-owner': 'o1', 'x-body': 'true' });
  });

  it('asks for runs by its filters, and a summary by id or by name', async () => {
    const { client, fetch } = setup();
    await client.runs(SCOPE);
    await client.runs(SCOPE, { rule: 'r1', result: 'failed', since: 5, limit: 200 });
    await client.summary({ ...SCOPE, tabId: null }, { ruleId: 'r1', name: 'Rule' });
    await client.summary({ ...SCOPE, tabId: 't1' }, { name: 'My Rule' });
    expect(fetch.mock.calls.map(([url]) => url.split('/automations')[1])).toEqual([
      '/runs',
      '/runs?rule=r1&result=failed&since=5&limit=200',
      '/summary?rule=r1',
      '/summary?name=My+Rule&tabId=t1',
    ]);
  });

  it('answers nothing for a 204, through the app’s own reading', async () => {
    const { client, api } = setup(() => new Response(null, { status: 204 }));
    await expect(client.remove(SCOPE, 'r1')).resolves.toBeUndefined();
    expect(api.expectOkVoid).toHaveBeenCalled();
  });

  it('throws a refusal the api names, with its path and message', async () => {
    const { client } = setup(() =>
      Response.json(
        { error: 'automation_invalid', path: 'steps.0.text', message: 'steps.0.text must be text' },
        { status: 400 },
      ),
    );
    const refusal = await client.list(SCOPE).catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(AutomationRefusal);
    expect(refusal).toMatchObject({
      name: 'AutomationRefusal',
      status: 400,
      code: 'automation_invalid',
      path: 'steps.0.text',
      message: 'steps.0.text must be text',
    });
    // No path, no message: the code stands for both.
    const bare = setup(() => Response.json({ error: 'automations_need_editor' }, { status: 403 }));
    await expect(bare.client.list(SCOPE)).rejects.toMatchObject({
      code: 'automations_need_editor',
      path: null,
      message: 'automations_need_editor',
    });
  });

  it('leaves any other failure to the app', async () => {
    const other = setup(() => Response.json({ error: 'not_ours' }, { status: 500 }));
    await expect(other.client.list(SCOPE)).rejects.toThrow('status 500');
    const noCode = setup(() => Response.json({ message: 'broken' }, { status: 500 }));
    await expect(noCode.client.list(SCOPE)).rejects.toThrow('status 500');
    const notJson = setup(() => new Response('<html>', { status: 502 }));
    await expect(notJson.client.list(SCOPE)).rejects.toThrow('status 502');
  });
});
