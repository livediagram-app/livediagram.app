import { describe, expect, it, vi } from 'vitest';
import { emptySheet, sheetToJson } from '@livediagram/sheets';
// The resvg WASM renderer cannot load in plain node (see tools.test.ts); the sheet tools never render.
vi.mock('./image-result', () => ({ imageResult: () => ({ content: [] }) }));

import { connectTestClient } from './mcp-test-client';

// The sheet tools end to end through a real SDK client (docs/specs/029-sheets/sheet-store.md "Agents"): a mistake
// the caller can fix is a tool error in words, never a protocol error.
const SHEET = sheetToJson(emptySheet({ id: 'sheet_costs1', tabId: 't1', title: 'Costs' }));
const LIVE_DOC = { id: 'd1', name: 'Budget', tabs: [{ id: 't1', name: 'Tab 1', orderIndex: 0 }] };

function api(opts: { refuseWrites?: string } = {}) {
  const writes: unknown[] = [];
  const handler = async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname.replace(/^\/api/, '');
    if (path.endsWith('/events')) return new Response(null, { status: 204 });
    if (path.endsWith('/sheets')) return Response.json({ sheets: [SHEET] });
    if (path.endsWith('/writes')) {
      const body = (await request.json()) as { write: unknown };
      writes.push(body);
      return opts.refuseWrites
        ? Response.json({ error: opts.refuseWrites }, { status: 413 })
        : Response.json({ applied: body.write, rev: writes.length, cells: [] });
    }
    return Response.json({ document: LIVE_DOC });
  };
  return { handler, writes };
}

type Result = {
  isError?: boolean;
  content: { text: string }[];
  structuredContent?: Record<string, unknown>;
};

async function call(
  handler: (r: Request) => Promise<Response>,
  name: string,
  args: Record<string, unknown>,
) {
  const client = await connectTestClient(handler);
  return (await client.callTool({ name, arguments: { documentId: 'd1', ...args } })) as Result;
}

describe('the sheet tools', () => {
  it('read a sheet by title, and refuse one that is not there, naming the sheets', async () => {
    const { handler } = api();
    const read = await call(handler, 'read_sheet', { sheet: 'costs', range: 'A1:B2' });
    expect(read.structuredContent).toMatchObject({ title: 'Costs', range: 'A1:B2', cells: [] });
    const missing = await call(handler, 'read_sheet', { sheet: 'Budget' });
    expect(missing.isError).toBe(true);
    expect(missing.content[0]!.text).toBe('No sheet "Budget". Sheets: "Costs" (sheet_costs1).');
  });

  it('say which changes went through before a refusal', async () => {
    const { handler, writes } = api({ refuseWrites: 'sheet_full' });
    const result = await call(handler, 'change_sheet', {
      sheet: 'Costs',
      changes: [{ op: 'set', at: 'A1', rows: [['x']] }],
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain(
      'The api refused it: this sheet holds the most cells it can',
    );
    expect(writes).toHaveLength(1);
    const { handler: ok } = api();
    const partly = await call(ok, 'change_sheet', {
      sheet: 'Costs',
      changes: [
        { op: 'freeze', rows: 1 },
        { op: 'rename', title: '' },
      ],
    });
    expect(partly.content[0]!.text).toBe(
      'A sheet title is 1 to 60 characters. Applied before it: froze 1 row.',
    );
  });

  it('refuse a change the schema does not know', async () => {
    const { handler } = api();
    const result = await call(handler, 'change_sheet', {
      sheet: 'Costs',
      changes: [{ op: 'merge' }],
    });
    expect(result.isError).toBe(true);
  });

  it('take the first cells of a new sheet as rows or CSV, not both', async () => {
    const { handler } = api();
    const result = await call(handler, 'add_sheet', { rows: [['a']], csv: 'a' });
    expect(result.content[0]!.text).toBe('Give the first cells as rows or as csv, not both.');
  });

  it('refuse a new sheet on a tab the document lacks', async () => {
    const { handler } = api();
    const result = await call(handler, 'add_sheet', { tabId: 'nope' });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe('No tab "nope". Tabs: Tab 1 (t1).');
  });
});
