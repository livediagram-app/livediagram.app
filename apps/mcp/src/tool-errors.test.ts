import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { mcpListTrash } from '@livediagram/agent-verbs/mcp';
import { ApiError } from './api';
import type { Env } from './env';
import { registerTool } from './tool-annotations';
import { loadTab, ToolInputError } from './tool-helpers';
import { deleteRefusal, templateNote } from './tools';

// Errors that teach (docs/specs/026-plan/plan-agents.md; docs/specs/015-api/mcp-server.md): a mistake the caller
// can fix is a tool error in words, never a thrown protocol error.

vi.mock('./render', () => ({ svgToPngBase64: async () => '' }));
vi.mock('./api', async (original) => ({
  ...(await original<typeof import('./api')>()),
  postTelemetry: () => undefined,
}));

function handlerFor(run: () => unknown) {
  let handler: ((...a: unknown[]) => Promise<unknown>) | undefined;
  const server = {
    registerTool: (name: string, _c: unknown, h: (...a: unknown[]) => Promise<unknown>) => {
      if (name === 'list_trash') handler = h;
    },
  } as unknown as McpServer;
  registerTool(server, {} as Env, mcpListTrash, run as never);
  return handler!;
}

describe('registerTool answers fixable errors', () => {
  it('turns an api 4xx and a ToolInputError into tool errors, and lets a 5xx throw', async () => {
    const gone = await handlerFor(() => {
      throw new ApiError(410, '{"error":"gone"}');
    })({}, {});
    expect(gone).toMatchObject({
      isError: true,
      content: [{ text: expect.stringContaining('in the Trash') }],
    });
    const input = await handlerFor(() => {
      throw new ToolInputError('No tab "x".');
    })({}, {});
    expect(input).toEqual({ isError: true, content: [{ type: 'text', text: 'No tab "x".' }] });
    await expect(
      handlerFor(() => {
        throw new ApiError(503, '');
      })({}, {}),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe('deleteRefusal', () => {
  it('says why, by status and what was deleted', () => {
    expect(deleteRefusal(410, false)).toContain('already in the Trash');
    expect(deleteRefusal(403, true)).toContain('view this document but not change it');
    expect(deleteRefusal(404, true)).toContain('read_document lists its tabs');
    expect(deleteRefusal(404, false)).toContain('find_documents');
    expect(deleteRefusal(400, true)).toContain('last one');
    expect(deleteRefusal(400, false)).toContain('Check the document id');
  });
});

describe('templateNote', () => {
  it('says when add_tab took only the first of a template’s tabs', () => {
    expect(templateNote('kanban').note).toMatch(
      /^The kanban template has \d+ tabs; add_tab added its first/,
    );
    expect(templateNote('flowchart')).toEqual({});
    expect(templateNote(undefined)).toEqual({});
    expect(templateNote('nope')).toEqual({});
  });
});

describe('loadTab', () => {
  it('names the tabs there are when asked for one the document lacks', async () => {
    const env = {
      API: {
        fetch: async () =>
          Response.json({
            document: { id: 'd', tabs: [{ id: 't1', name: 'Board', orderIndex: 0 }] },
          }),
      },
    } as unknown as Env;
    await expect(loadTab(env, 'tok', 'd', 'nope')).rejects.toThrow('Tabs: Board (t1).');
  });
});
