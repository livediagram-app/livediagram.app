import { describe, expect, it, vi } from 'vitest';
// The resvg WASM renderer cannot load in plain node (see tools.test.ts); the components tool never renders.
vi.mock('./image-result', () => ({ imageResult: () => ({ content: [] }) }));

import { connectTestClient } from './mcp-test-client';

// change_components end to end through a real SDK client (docs/specs/015-api/mcp-server.md §4.9e): a mistake the
// caller can fix is a tool error in words.
const LIVE_DOC = { id: 'd1', name: 'Shop', tabs: [{ id: 't1', name: 'Home', orderIndex: 0 }] };
const BOX = { id: 'b1', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 40 };
const TAB = { id: 't1', name: 'Home', rev: 3, elements: [BOX] };
const MAIN = { id: 'card', name: 'Card', width: 100, height: 40, updatedAt: 1, elements: [BOX] };
const WRITTEN = {
  dryRun: false,
  changeset: { id: 'cs_1', tabId: 't1', rev: 4, previousRev: 3, rebasedOver: 0 },
  results: [],
  text: '+ card  instance\nrev 3→4 · cs_1 · lint clean · revert: livedesign changeset revert d1 cs_1',
  warnings: [],
  lint: null,
};

type Routes = {
  changeset?: () => Response;
  main?: () => Response;
  design?: unknown;
};

function api(routes: Routes = {}) {
  const sent: { method: string; path: string; body: unknown }[] = [];
  const handler = async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname.replace(/^\/api/, '');
    if (path.endsWith('/events')) return new Response(null, { status: 204 });
    if (request.method !== 'GET')
      sent.push({ method: request.method, path, body: await request.json() });
    if (path.endsWith('/changesets')) return (routes.changeset ?? (() => Response.json(WRITTEN)))();
    if (path.endsWith('/components')) return Response.json({ components: [] });
    if (path.includes('/components/')) {
      if (routes.main) return routes.main();
      return Response.json({ component: sent.at(-1)!.body });
    }
    if (/\/tabs\/[^/]+$/.test(path)) return Response.json({ tab: TAB });
    return Response.json({ design: routes.design ?? LIVE_DOC });
  };
  return { handler, sent };
}

type Result = {
  isError?: boolean;
  content: { text: string }[];
  structuredContent?: Record<string, unknown>;
};

async function call(handler: (r: Request) => Promise<Response>, args: Record<string, unknown>) {
  const client = await connectTestClient(handler);
  return (await client.callTool({
    name: 'change_components',
    arguments: { designId: 'd1', ...args },
  })) as Result;
}

describe('change_components', () => {
  it('make stores the main, then swaps the elements for one instance at the revision read', async () => {
    const { handler, sent } = api();
    const out = await call(handler, { make: { elementIds: ['b1'], name: 'Card' } });
    expect(out.isError).toBeFalsy();
    expect(sent.map((s) => [s.method, s.path])).toEqual([
      ['PUT', '/designs/d1/components/card'],
      ['POST', '/designs/d1/tabs/t1/changesets'],
    ]);
    expect(sent[1]!.body).toMatchObject({ base: { rev: 3, elements: { b1: expect.any(String) } } });
    expect(out.structuredContent).toMatchObject({
      component: { id: 'card', name: 'Card', elements: 1 },
      lines: ['+ card  instance', 'rev 3→4 · cs_1 · lint clean'],
      rev: 4,
    });
  });

  it('patch changes a main and writes no tab', async () => {
    const { handler, sent } = api({ main: () => Response.json({ component: MAIN }) });
    const out = await call(handler, { patch: { componentId: 'card', archived: true } });
    expect(sent).toEqual([
      { method: 'PATCH', path: '/designs/d1/components/card', body: { archived: true } },
    ]);
    expect(out.structuredContent).toMatchObject({
      component: { id: 'card' },
      lines: [],
      rev: null,
    });
  });

  it('detach sends the detach operation on the element the word names', async () => {
    const { handler, sent } = api({
      changeset: () => Response.json({ ...WRITTEN, changeset: null, text: 'no change' }),
    });
    const out = await call(handler, { detach: { instance: 'b1' } });
    expect(sent[0]!.body).toMatchObject({ operations: [{ op: 'detach', target: 'id:"b1"' }] });
    expect(out.structuredContent).toMatchObject({ component: null, rev: 3, lines: ['no change'] });
    await call(handler, { detach: { instance: 'zz' } });
    expect(sent[1]!.body).toMatchObject({ operations: [{ op: 'detach', target: 'zz' }] });
  });

  it('refuses in words: not one change, a refused make, patch or detach, a design with no tabs', async () => {
    const texts = async (routes: Routes, args: Record<string, unknown>) => {
      const out = await call(api(routes).handler, args);
      expect(out.isError).toBe(true);
      return out.content[0]!.text;
    };
    expect(await texts({}, {})).toBe('Give exactly one of "make", "patch" and "detach".');
    expect(await texts({}, { make: { elementIds: ['b1'] }, detach: { instance: 'b1' } })).toMatch(
      /exactly one/,
    );
    expect(await texts({}, { make: { elementIds: ['zz'] } })).toBe('"zz" names no element');
    const notFound = () => Response.json({ error: 'not_found' }, { status: 404 });
    expect(await texts({ main: notFound }, { patch: { componentId: 'gone' } })).toBe(
      'no such component in this design',
    );
    const refused = () =>
      Response.json(
        { error: 'invalid_value', text: 'b1: b1 is not a component instance' },
        { status: 400 },
      );
    expect(await texts({ changeset: refused }, { detach: { instance: 'b1' } })).toBe(
      'b1: b1 is not a component instance',
    );
    expect(
      await texts({ changeset: refused }, { make: { elementIds: ['b1'], name: 'Card' } }),
    ).toBe(
      'b1: b1 is not a component instance\nThe component card ("Card") was stored, but the tab did not change; place it with an add of shape instance, componentId card.',
    );
    expect(await texts({ design: { ...LIVE_DOC, tabs: [] } }, { detach: { instance: 'b1' } })).toBe(
      'That design has no tabs.',
    );
  });

  it('a fault in a tab write is not the model’s to correct', async () => {
    const down = () => new Response('down', { status: 503 });
    for (const args of [{ detach: { instance: 'b1' } }, { make: { elementIds: ['b1'] } }]) {
      const out = await call(api({ changeset: down }).handler, args);
      expect(out.isError).toBe(true);
      expect(out.content[0]!.text).not.toMatch(/was stored/);
    }
  });
});
