import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { VIEW_MIME_TYPE } from '@liveworkspace/mcp-kit/app-view';
import { ITEM_TYPES } from '@liveplanner/items';

// The resvg WASM renderer cannot load in plain node; registering tools never renders.
vi.mock('./image-result', () => ({ imageResult: () => ({ content: [] }) }));

import { registerTools } from './tools';
import { registerViewPage, VIEW_URI, viewTab } from './view-tab';

// docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)": the page, the tools that link it, and view_tab.

type Registered = { name: string; config: { _meta?: Record<string, unknown> } };

function registrations(): Registered[] {
  const seen: Registered[] = [];
  const server = {
    registerTool: (name: string, config: Registered['config']) => void seen.push({ name, config }),
  } as unknown as McpServer;
  registerTools(server, {} as Env);
  return seen;
}

const plan = (boards: unknown[]) => ({
  boards,
  statuses: [{ status: 'todo', name: 'To Do' }],
  types: ITEM_TYPES,
  itemTypesRev: 1,
});
const board = {
  tabId: 't1',
  tabName: 'Sprint',
  elementId: 'b1',
  title: 'Sprint board',
  kind: 'board',
  types: null,
  columns: [{ status: 'todo', name: 'To Do' }],
};
const card = {
  id: 'i1',
  type: 'task',
  key: 1,
  rank: 'a0',
  fields: { title: 'Write the brief', status: 'todo' },
  rev: 1,
  createdAt: 1,
  updatedAt: 1,
  createdBy: { id: 'u1', name: 'Ada' },
  updatedBy: { id: 'u1', name: 'Ada' },
};

function envFor(boards: unknown[]): Env {
  const fetch = async (request: Request) => {
    const path = new URL(request.url).pathname;
    const body = path.endsWith('/items') ? { items: [card] } : plan(boards);
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  };
  return { API: { fetch } } as unknown as Env;
}

describe('the interactive view', () => {
  it('links list_items and read_project, and only those', () => {
    const linked = registrations()
      .filter((r) => (r.config._meta?.ui as { resourceUri?: string })?.resourceUri === VIEW_URI)
      .map((r) => r.name)
      .sort();
    expect(linked).toEqual(['list_items', 'read_project']);
  });

  it('keeps view_tab from the model in a host with MCP Apps', () => {
    const view = registrations().find((r) => r.name === 'view_tab')!;
    expect(view.config._meta).toEqual({ ui: { visibility: ['app'] } });
  });

  it('lists the board page under its ui:// address, with a CSP that opens no connection', async () => {
    const seen: {
      uri: string;
      meta: { ui: { csp: unknown } };
      read: (uri: URL) => Promise<unknown>;
    }[] = [];
    const server = {
      registerResource: (
        _n: string,
        uri: string,
        m: { _meta: { ui: { csp: unknown } } },
        read: (uri: URL) => Promise<unknown>,
      ) => void seen.push({ uri, meta: m._meta, read }),
    } as unknown as McpServer;
    registerViewPage(server);
    expect(seen.map((r) => r.uri)).toEqual([VIEW_URI]);
    expect(seen[0]!.meta.ui.csp).toEqual({ connectDomains: [], resourceDomains: [] });
    const { contents } = (await seen[0]!.read(new URL(VIEW_URI))) as {
      contents: { mimeType: string; text: string }[];
    };
    expect(contents[0]!.mimeType).toBe(VIEW_MIME_TYPE);
    // The board viewer, keyed by the plan's id, with no live room to follow.
    expect(contents[0]!.text).toContain('id="board"');
    expect(contents[0]!.text).toContain('"projectId"');
    expect(contents[0]!.text).not.toContain('WebSocket(');
  });

  it('draws the boards of a plan, in one line of text', async () => {
    const result = await viewTab(envFor([board]), 'lwt_x', { projectId: 'p1' });
    expect(result.content).toEqual([
      { type: 'text', text: 'Drew the boards on tab "Sprint" for the interactive view.' },
    ]);
    expect(result.structuredContent).toMatchObject({
      projectId: 'p1',
      tabId: 't1',
      boards: [{ id: 'b1', columns: [{ name: 'To Do', count: 1, cards: [{ ref: '#1' }] }] }],
    });
  });

  it('says so for a plan without a board', async () => {
    const result = await viewTab(envFor([]), 'lwt_x', { projectId: 'p1' });
    expect(result.content).toEqual([{ type: 'text', text: 'This plan has no board to draw.' }]);
  });
});
