// The apps' graph door (liveworkspace/docs/specs/004-index/send-to-diagram.md), answered by handleInternalItems.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleInternalItems, type GraphItemResult, type InternalItemHandlers } from './internal';

afterEach(() => vi.restoreAllMocks());

const OPTIONS = { key: 'index-key', driveKey: 'drive-key', exportKey: 'media-key' };
const BODY = {
  owner: 'user_ada',
  name: 'Onboarding diagram',
  graph: { nodes: [{ id: 'a', label: 'Start' }], edges: [] },
  caption: 'From Handbook, Onboarding',
  link: 'https://www.liveknowledge.app/document/d1#t=t1',
};

const request = (body: unknown, auth = 'index-key') =>
  new Request('https://app.test/api/internal/items/from-graph', {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const send = (req: Request, handlers: Partial<InternalItemHandlers>) =>
  handleInternalItems(req, { ...OPTIONS, handlers: { purge: async () => {}, ...handlers } });

const making = (result: GraphItemResult = { status: 'ok', id: 'NEW' }) => vi.fn(async () => result);

describe('the graph door', () => {
  it('makes the item on the index key, answering its id', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const run = making();
    const res = await send(request(BODY), { fromGraph: run });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 'NEW' });
    expect(run).toHaveBeenCalledWith(BODY);
  });

  it('is a 404 for an app without it, and refuses another key', async () => {
    expect((await send(request(BODY), {})).status).toBe(404);
    expect((await send(request(BODY, 'drive-key'), { fromGraph: making() })).status).not.toBe(201);
  });

  it('refuses a body that does not read', async () => {
    const run = making();
    expect((await send(request('not json'), { fromGraph: run })).status).toBe(400);
    expect(
      (await send(request({ ...BODY, graph: { nodes: [] } }), { fromGraph: run })).status,
    ).toBe(400);
    expect((await send(request({ ...BODY, owner: 'guest_1' }), { fromGraph: run })).status).toBe(
      400,
    );
    expect(run).not.toHaveBeenCalled();
  });

  it("answers the app's refusals and failures", async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      (await send(request(BODY), { fromGraph: making({ status: 'invalid_graph' }) })).status,
    ).toBe(422);
    expect((await send(request(BODY), { fromGraph: making({ status: 'too_large' }) })).status).toBe(
      413,
    );
    const broken = vi.fn(async () => {
      throw new Error('down');
    });
    expect((await send(request(BODY), { fromGraph: broken })).status).toBe(503);
  });
});
