import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { mcpListTrash } from '@liveknowledge/agent-verbs/mcp';
import { ApiError } from './api';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { registerTool } from './tool-annotations';
import { ToolInputError } from './tool-helpers';
import { deleteRefusal } from '@liveknowledge/agent-verbs';

// Errors that teach (docs/specs/015-api/mcp-server.md): a mistake the caller
// can fix is a tool error in words, never a thrown protocol error.

vi.mock('@liveworkspace/mcp-kit/render', () => ({ svgToPngBase64: async () => '' }));
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
  it('turns an api 4xx and a ToolInputError into tool errors, and lets a 5xx throw in words', async () => {
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
    ).rejects.toThrow(
      'The service behind this tool did not finish the call (HTTP 503). Try again in a moment.',
    );
  });
});

describe('a refusal the api worded', () => {
  it('is answered in the api’s own words', async () => {
    const verified = await handlerFor(() => {
      throw new ApiError(
        409,
        JSON.stringify({
          error: 'page_verified',
          message: 'This page is verified. Use suggest_edit.',
        }),
      );
    })({}, {});
    expect(verified).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'This page is verified. Use suggest_edit.' }],
    });
  });
});

describe('deleteRefusal', () => {
  it('says why, by status and what was deleted', () => {
    expect(deleteRefusal(410, false)).toContain('already in the Trash');
    expect(deleteRefusal(404, false)).toContain('find_documents');
    expect(deleteRefusal(404, false)).toContain('No such knowledgebase');
    expect(deleteRefusal(503, true)).toContain('503');
    expect(deleteRefusal(400, false)).toContain('Check the knowledgebase id');
  });
});
