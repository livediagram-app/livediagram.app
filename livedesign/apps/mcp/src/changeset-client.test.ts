import { describe, expect, it, vi } from 'vitest';
import { elementFingerprint, type Element, type Tab } from '@livepages/document';
vi.mock('./image-result', () => ({
  imageResult: (value: Record<string, unknown>) => ({
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: value,
  }),
}));
import { ApiError } from './api';
import {
  baseFor,
  changesetErrorText,
  editsBase,
  mcpOpsToEditOperations,
  mcpResultText,
  replaceBodyFrom,
} from './changeset-client';
import { connectTestClient } from './mcp-test-client';

// The MCP onto changesets (docs/specs/015-api/mcp-server.md §4.3a, §4.4; blueprint
// docs/specs/024-agents/blueprints/agent-changesets.md "MCP").

const box = (id: string, label = id): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  label,
});
const tab: Tab & { rev: number } = { id: 't1', name: 'T', elements: [box('a'), box('b')], rev: 7 };

describe('editsBase', () => {
  it('bases edits on the revision read and every element as loaded, since the text may name any', () => {
    const base = editsBase(tab, 5);
    expect(base.rev).toBe(5);
    expect(Object.keys(base.elements).sort()).toEqual(['a', 'b']);
    expect(editsBase(tab).rev).toBe(7);
  });
});

describe('mcpOpsToEditOperations', () => {
  const ends = (from: string, to: string) => ({
    from: { kind: 'pinned', elementId: from, anchor: 's' },
    to: { kind: 'pinned', elementId: to, anchor: 'n' },
  });
  const refTab: Tab = {
    id: 't2',
    name: 'T',
    elements: [box('4aeb12f0-aaaa'), box('9c11aa00-bbbb')],
  };

  it('packs a stroke’s new points with its new box, and refuses points it cannot draw', () => {
    const stroke = {
      id: 'ring',
      type: 'freehand',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      closed: true,
      packedPoints: 'AQA=',
    } as unknown as Element;
    const tab: Tab = { id: 't3', name: 'T', elements: [stroke] };
    const points = [
      [100, 50],
      [140, 90],
      [100, 130],
    ];
    const ops = mcpOpsToEditOperations(
      [{ op: 'update', elementId: 'ring', element: { points, penColour: 'red' } }],
      tab,
    ) as { fields: Record<string, unknown> }[];
    expect(ops[0]!.fields).toMatchObject({
      x: 100,
      y: 50,
      width: 40,
      height: 80,
      penColour: 'red',
    });
    expect(ops[0]!.fields.points).toBeUndefined();
    expect(ops[0]!.fields.packedPoints).not.toBe('AQA=');
    expect(
      mcpOpsToEditOperations([{ op: 'update', elementId: 'ring', element: { points: [] } }], tab),
    ).toMatch(/^ops\[1\]: element 1: "points" takes 1 to/);
  });

  it('pins an added arrow by the refs read_document prints, and to an element added in the same call', () => {
    const ops = mcpOpsToEditOperations(
      [
        {
          op: 'add',
          element: { id: 'new', type: 'shape', shape: 'square', x: 0, y: 0, width: 1, height: 1 },
        },
        { op: 'add', element: { id: 'a1', type: 'arrow', ...ends('4aeb', 'new') } },
      ],
      refTab,
    );
    expect(ops).toEqual([
      expect.anything(),
      { op: 'add', element: { id: 'a1', type: 'arrow', ...ends('4aeb12f0-aaaa', 'new') } },
    ]);
  });

  it('refuses an arrow end that names nothing rather than storing an arrow to nowhere', () => {
    const ops = mcpOpsToEditOperations(
      [{ op: 'add', element: { id: 'a1', type: 'arrow', ...ends('4aeb', 'gone') } }],
      refTab,
    );
    expect(ops).toMatch(/^ops\[1\]: arrow "a1": "to" is pinned to "gone"/);
  });

  it('resolves refs in an update that re-pins an existing arrow', () => {
    const withArrow: Tab = {
      ...refTab,
      elements: [
        ...refTab.elements,
        { id: 'ar', type: 'arrow', ...ends('4aeb12f0-aaaa', '9c11aa00-bbbb') } as Element,
      ],
    };
    const ops = mcpOpsToEditOperations(
      [
        {
          op: 'update',
          elementId: 'ar',
          element: { to: { kind: 'pinned', elementId: '4aeb', anchor: 'e' } },
        },
      ],
      withArrow,
    );
    expect(ops).toEqual([
      {
        op: 'set',
        target: 'id:"ar"',
        fields: { to: { kind: 'pinned', elementId: '4aeb12f0-aaaa', anchor: 'e' } },
      },
    ]);
  });

  it('maps add, update and remove onto add, set and rm, dropping an unchanged id or type', () => {
    expect(
      mcpOpsToEditOperations(
        [
          {
            op: 'add',
            element: { id: 'n', type: 'shape', shape: 'square', x: 0, y: 0, width: 1, height: 1 },
          },
          { op: 'update', elementId: 'a', element: { id: 'a', type: 'shape', label: 'Sign in' } },
          { op: 'remove', elementId: 'b' },
        ],
        tab,
      ),
    ).toEqual([
      {
        op: 'add',
        element: { id: 'n', type: 'shape', shape: 'square', x: 0, y: 0, width: 1, height: 1 },
      },
      { op: 'set', target: 'id:"a"', fields: { label: 'Sign in' } },
      { op: 'rm', target: 'id:"b"' },
    ]);
  });

  it('takes a ref as read_document prints it, and passes a word naming nothing as given', () => {
    const uuid = '7f3a2c91-0000-4000-8000-000000000001';
    const withUuid: Tab = { ...tab, elements: [...tab.elements, box(uuid), box('frame')] };
    expect(
      mcpOpsToEditOperations(
        [
          { op: 'update', elementId: '7f3a', element: { id: uuid, label: 'x' } },
          { op: 'remove', elementId: 'frame' },
          { op: 'remove', elementId: 'nowhere' },
        ],
        withUuid,
      ),
    ).toEqual([
      { op: 'set', target: `id:"${uuid}"`, fields: { label: 'x' } },
      { op: 'rm', target: 'id:"frame"' },
      { op: 'rm', target: 'nowhere' },
    ]);
  });

  it('names an op missing what it needs', () => {
    expect(mcpOpsToEditOperations([{ op: 'update', elementId: 'a' }], tab)).toBe(
      'ops[1]: update needs "elementId" and "element"',
    );
  });
});

describe('baseFor', () => {
  it('bases on the revision the model read, fingerprinting the named elements as they are now', () => {
    expect(
      baseFor(
        [
          { op: 'update', elementId: 'a', element: {} },
          { op: 'add', element: {} },
        ],
        tab,
        5,
      ),
    ).toEqual({
      rev: 5,
      elements: { a: elementFingerprint(box('a')) },
    });
    expect(baseFor([], tab).rev).toBe(7);
    const uuid = '7f3a2c91-0000-4000-8000-000000000001';
    const withUuid = { ...tab, elements: [...tab.elements, box(uuid)] };
    expect(baseFor([{ op: 'remove', elementId: '7f3a' }], withUuid).elements).toEqual({
      [uuid]: elementFingerprint(box(uuid)),
    });
  });
});

describe('replaceBodyFrom', () => {
  it('takes one source with its layout, theme and name', () => {
    expect(replaceBodyFrom({ template: 'kanban', theme: 'ocean', name: 'Board' })).toEqual({
      template: 'kanban',
      theme: 'ocean',
      name: 'Board',
    });
    expect(replaceBodyFrom({ elements: [], layout: 'auto' })).toEqual({
      elements: [],
      layout: 'auto',
    });
  });
});

describe('changesetErrorText', () => {
  it("prefers the route's own text, then names held elements and conflicts", () => {
    expect(
      changesetErrorText(
        new ApiError(
          422,
          JSON.stringify({ error: 'target_not_found', text: 'error target_not_found · op 1' }),
        ),
      ),
    ).toBe('error target_not_found · op 1');
    expect(
      changesetErrorText(
        new ApiError(
          409,
          JSON.stringify({
            error: 'elements_held',
            held: [{ id: 'a', by: { name: 'Bea', color: '#f00' } }],
          }),
        ),
      ),
    ).toContain('a (held by Bea)');
    expect(
      changesetErrorText(
        new ApiError(
          409,
          JSON.stringify({
            error: 'changeset_conflict',
            conflicts: [{ id: 'a', reason: 'changed' }],
          }),
        ),
      ),
    ).toContain('read_document');
  });
});

describe('the tools on changesets', () => {
  async function connect(answer: (path: string, body: unknown) => Response | undefined) {
    const sent: { method: string; path: string; body: unknown }[] = [];
    const client = await connectTestClient(async (request) => {
      const path = new URL(request.url).pathname.replace(/^\/api/, '');
      const text = await request.text();
      const body: unknown = text ? JSON.parse(text) : null;
      sent.push({ method: request.method, path, body });
      const custom = answer(path, body);
      if (custom) return custom;
      if (path.endsWith('/events')) return new Response(null, { status: 204 });
      if (/\/tabs\/[^/]+$/.test(path)) return Response.json({ tab });
      return Response.json({ document: { id: 'd1', name: 'D', tabs: [{ id: 't1', name: 'T' }] } });
    });
    return { client, sent };
  }

  it('update_document ops submits one based changeset as the MCP client, and no whole-tab save', async () => {
    const { client, sent } = await connect((path) =>
      path.endsWith('/changesets')
        ? Response.json({
            dryRun: false,
            changeset: { id: 'cs_0000000001', tabId: 't1', rev: 8, previousRev: 7, rebasedOver: 0 },
            results: [],
            text: 'done',
            warnings: [],
            lint: {
              measures: {
                crossings: 1,
                behind: 0,
                overlaps: 0,
                extent: { width: 300, height: 200 },
                arrows: 2,
                boxes: 3,
              },
              findings: [],
              counts: { error: 0, warning: 1, info: 0 },
              skipped: { crossings: false },
            },
          })
        : undefined,
    );
    const result = await client.callTool({
      name: 'update_document',
      arguments: { documentId: 'd1', mode: 'ops', rev: 6, ops: [{ op: 'remove', elementId: 'b' }] },
    });
    expect(result.isError).not.toBe(true);
    const submitted = sent.find((s) => s.path === '/documents/d1/tabs/t1/changesets')!;
    expect(submitted).toMatchObject({
      method: 'POST',
      body: {
        operations: [{ op: 'rm', target: 'id:"b"' }],
        base: { rev: 6, elements: { b: elementFingerprint(box('b')) } },
      },
    });
    expect(sent.some((s) => s.method === 'PUT' && /\/tabs\/[^/]+$/.test(s.path))).toBe(false);
    const line = '1 crossing · 0 behind · 0 overlaps · 300×200 → 1 warning';
    expect(result.structuredContent).toMatchObject({
      changesetId: 'cs_0000000001',
      text: 'done',
      lint: line,
    });
  });

  it('turns a refused changeset into the model-correctable message, never an Error event', async () => {
    const { client, sent } = await connect((path) =>
      path.endsWith('/changesets')
        ? Response.json(
            { error: 'elements_held', held: [{ id: 'b', by: { name: 'Bea', color: '#f00' } }] },
            { status: 409 },
          )
        : undefined,
    );
    const result = await client.callTool({
      name: 'update_document',
      arguments: { documentId: 'd1', mode: 'ops', ops: [{ op: 'remove', elementId: 'b' }] },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('held by Bea');
    const events = sent.filter((s) => s.path === '/events').map((s) => JSON.stringify(s.body));
    expect(events.some((e) => e.includes('"Error"'))).toBe(false);
  });
});

describe('mcpResultText', () => {
  it('says how printed positions map to canvas coordinates when the content does not start at 0,0', () => {
    const text = '+ a  square "A" @10,20 140×60\nrev 1→2 · cs_1 · lint clean';
    expect(mcpResultText(text, { x: 120, y: 75.6 })).toBe(
      `${text}\n@x,y above are from the content's top-left: an element's x, y = @x + 120, @y + 76.`,
    );
    expect(mcpResultText(text, { x: 0, y: 0 })).toBe(text);
    expect(mcpResultText(text, { x: 0, y: -104 })).toMatch(/x, y = @x \+ 0, @y - 104\.$/);
    expect(mcpResultText('rev 1→2 · cs_1 · lint clean', { x: 5, y: 5 })).toBe(
      'rev 1→2 · cs_1 · lint clean',
    );
  });

  it('leaves off the CLI revert line no MCP tool runs, keeping the rest', () => {
    expect(
      mcpResultText(
        '+ a\nrev 1→2 · cs_1 · lint clean · revert: livepages changeset revert doc_1 cs_1',
      ),
    ).toBe('+ a\nrev 1→2 · cs_1 · lint clean');
    expect(mcpResultText('dry run · rev 4 · lint clean · nothing written')).toBe(
      'dry run · rev 4 · lint clean · nothing written',
    );
  });
});
