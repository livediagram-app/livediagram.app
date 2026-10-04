import { describe, expect, it, vi } from 'vitest';
import { elementFingerprint, type Element, type Tab } from '@livediagram/document';
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
  mcpOpsToEditOperations,
  replaceBodyFrom,
} from './changeset-client';
import { connectTestClient } from './mcp-test-client';

// The MCP onto changesets (docs/specs/015-api/mcp-server.md §4.3a, §4.4; blueprint
// docs/specs/024-agents/blueprints/agent-changesets.md "MCP").

const box = (id: string, label = id): Element =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, label }) as Element;
const tab: Tab & { rev: number } = { id: 't1', name: 'T', elements: [box('a'), box('b')], rev: 7 };

describe('mcpOpsToEditOperations', () => {
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
      { op: 'set', target: 'a', fields: { label: 'Sign in' } },
      { op: 'rm', target: 'b' },
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
      const body = text ? JSON.parse(text) : null;
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
            lint: null,
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
        operations: [{ op: 'rm', target: 'b' }],
        base: { rev: 6, elements: { b: elementFingerprint(box('b')) } },
      },
    });
    expect(sent.some((s) => s.method === 'PUT' && /\/tabs\/[^/]+$/.test(s.path))).toBe(false);
    expect(result.structuredContent).toMatchObject({ changesetId: 'cs_0000000001', text: 'done' });
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
