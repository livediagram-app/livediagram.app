import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ITEM_TYPES } from '@livediagram/items';
import {
  applySheetWrite,
  emptySheet,
  NOBODY,
  sheetFromJson,
  sheetToJson,
  Workbook,
  writeRows,
  type SheetJson,
  type SheetWrite,
} from '@livediagram/sheets';
// The resvg WASM renderer cannot load in plain node (see tools.test.ts). The
// stub keeps the structured result, which is what this suite checks.
vi.mock('./image-result', () => ({
  imageResult: (value: Record<string, unknown>) => ({
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: value,
  }),
}));

import { connectTestClient } from './mcp-test-client';
import * as outputs from '@livediagram/agent-verbs/mcp';

// Structured output and described parameters (docs/specs/015-api/mcp-server.md §4.17), end to end
// through a real SDK client and server: the server validates each success's
// structuredContent against the tool's outputSchema, the client validates it
// again after listTools, and the strict parse below catches the one drift
// neither SDK side does, a result field the schema never declared.

// A tab holding the Sprint board PLAN describes, for change_board.
const BOARD_ELEMENT = {
  id: 'b1',
  type: 'shape',
  shape: 'plan-board',
  x: 0,
  y: 0,
  width: 800,
  height: 500,
  planBoard: {
    title: 'Sprint',
    columns: [
      { id: 'todo', status: 'todo~a', name: 'To Do' },
      { id: 'done', status: 'done~a', name: 'Done' },
    ],
    swimlaneBy: 'none',
    cardFields: ['key'],
    voting: { on: false },
    hideWriting: false,
  },
};
// A filled sheet, framed by a Sheet element on the tab, for the sheet tools.
function filledSheet(): SheetJson {
  const blank = emptySheet({ id: 'sheet_costs1', tabId: 't1', title: 'Costs' });
  const rows = [
    ['Item', 'Cost'],
    ['Rent', 1200],
    ['Total', '=SUM(B2:B2)'],
  ];
  const made = writeRows(new Workbook({ sheets: [blank], locale: 'en-GB' }), blank.id, 'A1', rows);
  if (!made.ok) throw new Error(made.error);
  const sheet = applySheetWrite(blank, made.write, { now: 0, by: NOBODY }).sheet;
  return sheetToJson({ ...sheet, layout: { ...sheet.layout, frozenRows: 1, merges: [] } });
}
const SHEET = filledSheet();
const SHEET_ELEMENT = {
  id: 'sh1',
  type: 'shape',
  shape: 'plan-sheet',
  x: 900,
  y: 0,
  width: 960,
  height: 560,
  planSheet: { sheetId: SHEET.id },
};
const TAB = { id: 't1', name: 'Tab 1', rev: 3, elements: [BOARD_ELEMENT, SHEET_ELEMENT] };
// What the changeset route answers (docs/specs/024-agents/agent-changesets.md).
const CHANGESET = {
  dryRun: false,
  changeset: { id: 'cs_0000000001', tabId: 't1', rev: 4, previousRev: 3, rebasedOver: 0 },
  results: [],
  text: 'rev 3→4 · cs_0000000001',
  warnings: [],
  lint: null,
};
const ITEM = {
  id: 'item123abc',
  type: 'bug',
  key: 12,
  rank: 'i',
  fields: { title: 'Fix login', status: 'todo' },
  rev: 1,
  createdAt: 1,
  updatedAt: 1,
  createdBy: { id: 'p', name: 'P', color: '#000000' },
  updatedBy: { id: 'p', name: 'P', color: '#000000' },
};
const LIVE_DOC = { id: 'd1', name: 'Roadmap', tabs: [{ id: 't1', name: 'Tab 1' }] };
const BUG = {
  ...ITEM_TYPES[1],
  id: 'bug',
  label: 'Bug',
  custom: [
    {
      id: 'f-severity',
      label: 'Severity',
      kind: 'choice',
      options: ['S1', 'S2'],
      linkType: undefined,
    },
  ],
};
const PLAN = {
  boards: [
    {
      tabId: 't1',
      tabName: 'Tab 1',
      elementId: 'b1',
      title: 'Sprint',
      kind: 'board',
      types: ['task'],
      columns: [
        { status: 'todo~a', name: 'To Do', wipLimit: 3 },
        { status: 'done~a', name: 'Done' },
      ],
    },
  ],
  statuses: [
    { status: 'todo~a', name: 'To Do' },
    { status: 'done~a', name: 'Done' },
  ],
  types: [...ITEM_TYPES, BUG],
};

// A plausible api with non-empty lists, so the array item schemas are exercised.
async function api(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '');
  if (request.method === 'DELETE') return new Response(null, { status: 204 });
  const json = (body: unknown) => Response.json(body);
  // A document view: text with the tab revision as its ETag, as the api answers it.
  if (url.searchParams.has('view')) {
    return new Response('tab t1 "Tab 1" · 0 elements · rev 3', { headers: { ETag: 'W/"3"' } });
  }
  if (path === '/documents' && request.method === 'GET') {
    return json({ documents: [{ id: 'd1', name: 'Roadmap', savedAt: 1_700_000_000_000 }] });
  }
  if (path === '/teams') return json({ teams: [] });
  if (path.endsWith('/sheets'))
    return request.method === 'POST'
      ? json({ sheet: { ...SHEET, id: ((await request.json()) as { id: string }).id, cells: [] } })
      : json({ sheets: [SHEET] });
  if (path.endsWith('/writes')) {
    const { write } = (await request.json()) as { write: SheetWrite };
    const applied = applySheetWrite(sheetFromJson(SHEET), write, { now: 0, by: NOBODY }).applied;
    return json({ applied, rev: 2, cells: [] });
  }
  if (path === '/trash') {
    return json({
      trash: [{ id: 'd2', name: 'Old', teamId: null, trashedAt: 1, purgeAt: 2, reason: 'empty' }],
    });
  }
  if (path.endsWith('/items') && request.method === 'GET') return json({ items: [ITEM], rev: 1 });
  if (path.endsWith('/plan')) return json(PLAN);
  if (path.endsWith('/item-types')) return json({ itemTypes: null });
  if (/\/items(\/[^/]+(\/move)?)?$/.test(path)) return json({ item: ITEM, rev: 2 });
  if (path.endsWith('/restore')) return json({ document: LIVE_DOC });
  if (path.endsWith('/share'))
    return json({ link: { code: 'abc', role: 'view', expiresAt: null } });
  if (path.endsWith('/changesets')) return json(CHANGESET);
  if (path.endsWith('/name')) return json({ tab: { id: 't1', name: 'Renamed', orderIndex: 0 } });
  if (/\/tabs\/[^/]+$/.test(path)) return json({ tab: TAB });
  return json({ document: LIVE_DOC });
}

// Each tool, with both result branches of rename and delete.
const CALLS: { tool: string; output: keyof typeof outputs; args: Record<string, unknown> }[] = [
  { tool: 'find_documents', output: 'findDocumentsOutput', args: {} },
  { tool: 'read_document', output: 'readDocumentOutput', args: { documentId: 'd1' } },
  {
    tool: 'read_document',
    output: 'readDocumentOutput',
    args: { documentId: 'd1', format: 'json' },
  },
  { tool: 'list_templates', output: 'listTemplatesOutput', args: {} },
  {
    tool: 'create_document',
    output: 'createDocumentOutput',
    args: { name: 'New', tabs: [{ name: 'Tab', elements: [] }] },
  },
  {
    tool: 'add_tab',
    output: 'addTabOutput',
    args: { documentId: 'd1', name: 'Detail', elements: [] },
  },
  {
    tool: 'update_document',
    output: 'updateDocumentOutput',
    args: { documentId: 'd1', mode: 'replace', elements: [] },
  },
  { tool: 'share_document', output: 'shareDocumentOutput', args: { documentId: 'd1' } },
  {
    tool: 'rename_document',
    output: 'renameDocumentOutput',
    args: { documentId: 'd1', name: 'Renamed' },
  },
  {
    tool: 'rename_document',
    output: 'renameDocumentOutput',
    args: { documentId: 'd1', tabId: 't1', name: 'Renamed' },
  },
  { tool: 'delete_document', output: 'deleteDocumentOutput', args: { documentId: 'd1' } },
  {
    tool: 'delete_document',
    output: 'deleteDocumentOutput',
    args: { documentId: 'd1', tabId: 't1' },
  },
  { tool: 'list_trash', output: 'listTrashOutput', args: {} },
  { tool: 'restore_document', output: 'restoreDocumentOutput', args: { documentId: 'd2' } },
  { tool: 'list_items', output: 'listItemsOutput', args: { documentId: 'd1' } },
  {
    tool: 'change_items',
    output: 'changeItemsOutput',
    args: {
      documentId: 'd1',
      changes: [
        { op: 'add', title: 'New' },
        { op: 'move', item: '#12', status: 'Done' },
        { op: 'set', item: '12', fields: { priority: 'high' } },
        { op: 'delete', item: 'item123' },
      ],
    },
  },
  {
    tool: 'add_board',
    output: 'addBoardOutput',
    args: { documentId: 'd1', columns: ['Ideas', 'Done'], types: ['Task'] },
  },
  {
    tool: 'change_board',
    output: 'changeBoardOutput',
    args: {
      documentId: 'd1',
      board: 'Sprint',
      columns: ['To Do', 'Review', 'Done'],
      types: ['Bug'],
    },
  },
  {
    tool: 'change_card_types',
    output: 'changeCardTypesOutput',
    args: {
      documentId: 'd1',
      changes: [
        { op: 'add', name: 'Risk', custom: [{ name: 'Impact', kind: 'number' }] },
        { op: 'delete', type: 'Bug' },
      ],
    },
  },
  { tool: 'list_sheets', output: 'listSheetsOutput', args: { documentId: 'd1' } },
  { tool: 'read_sheet', output: 'readSheetOutput', args: { documentId: 'd1', sheet: 'Costs' } },
  {
    tool: 'change_sheet',
    output: 'changeSheetOutput',
    args: {
      documentId: 'd1',
      sheet: 'Costs',
      changes: [
        { op: 'set', at: 'C1', rows: [['Yearly'], ['=B2*12']] },
        { op: 'format', range: 'A1:C1', format: { bold: true } },
        { op: 'insert_rows', at: 2 },
        { op: 'freeze', rows: 1 },
      ],
    },
  },
  {
    tool: 'add_sheet',
    output: 'addSheetOutput',
    args: { documentId: 'd1', title: 'Costs', csv: 'a,b\n1,2' },
  },
];

describe('tool output schemas', () => {
  it('advertises an outputSchema on every tool', async () => {
    const client = await connectTestClient(api);
    const { tools } = await client.listTools();
    const missing = tools.filter((t) => !t.outputSchema).map((t) => t.name);
    expect(missing).toEqual([]);
  });

  it('covers every tool in this suite', async () => {
    // A new tool must be added to CALLS, or its schema is never exercised.
    const client = await connectTestClient(api);
    const { tools } = await client.listTools();
    // Deprecated aliases share their successor's output schema (tools.test.ts).
    const current = tools.filter((t) => !(t.description ?? '').startsWith('Deprecated'));
    expect(new Set(CALLS.map((c) => c.tool))).toEqual(new Set(current.map((t) => t.name)));
  });

  for (const { tool, args } of CALLS) {
    it(`${tool} ${JSON.stringify(args)} returns structured content matching its schema`, async () => {
      const client = await connectTestClient(api);
      // listTools primes the client's own outputSchema validation of callTool.
      await client.listTools();
      const result = await client.callTool({ name: tool, arguments: args });
      expect(result.isError, JSON.stringify(result.content)).toBeFalsy();
      const structured = result.structuredContent;
      // The output schema the tool's verb declares, which the server registered.
      z.object(outputs.MCP_TOOL_VERBS.find((v) => v.mcp.tool === tool)!.mcpShapes.output)
        .strict()
        .parse(structured);
      // The text block carries the same object for clients that ignore structuredContent; a view
      // carries its text, then one line naming the document, the tab and its revision (VW55).
      const [first] = result.content as { type: string; text: string }[];
      const view = z.object({ tab: z.object({ text: z.string() }) }).safeParse(structured);
      if (view.success) {
        const { tab, ...rest } = structured as { tab: { text: string; view: string } };
        const { text, view: _view, ...tabMeta } = tab;
        const [viewText, line, ...extra] = first!.text.split('\n');
        expect([viewText, extra]).toEqual([text, []]);
        expect(JSON.parse(line!)).toEqual({ ...rest, tab: tabMeta });
      } else {
        expect(JSON.parse(first!.text)).toEqual(structured);
      }
    });
  }

  it('sends no structuredContent on an error result', async () => {
    const client = await connectTestClient(api);
    const result = await client.callTool({
      name: 'create_document',
      arguments: { name: 'New', tabs: [{ name: 'Tab', template: 'no-such-template' }] },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
  });
});

describe('tool parameter descriptions', () => {
  type JsonSchema = {
    description?: string;
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
    anyOf?: JsonSchema[];
  };

  // Every property path, nested objects and array items included, with no description.
  function undescribed(schema: JsonSchema | undefined, path: string): string[] {
    if (!schema) return [];
    const nested = [schema.items, ...(schema.anyOf ?? [])].flatMap((s) => undescribed(s, path));
    const own = Object.entries(schema.properties ?? {}).flatMap(([key, prop]) => [
      ...(prop.description ? [] : [`${path}.${key}`]),
      ...undescribed(prop, `${path}.${key}`),
    ]);
    return [...own, ...nested];
  }

  it('describes every input parameter', async () => {
    const client = await connectTestClient(api);
    const { tools } = await client.listTools();
    const missing = tools.flatMap((t) => undescribed(t.inputSchema as JsonSchema, t.name));
    expect(missing).toEqual([]);
  });

  it('describes every output field', async () => {
    const client = await connectTestClient(api);
    const { tools } = await client.listTools();
    const missing = tools.flatMap((t) => undescribed(t.outputSchema as JsonSchema, t.name));
    expect(missing).toEqual([]);
  });
});
