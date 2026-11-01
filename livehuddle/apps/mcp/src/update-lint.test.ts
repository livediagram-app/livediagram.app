import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LintReport } from '@livediagram/api-schema';
import type { Env } from '@liveworkspace/mcp-kit/env';

// update_document's lint when an edit changed nothing (docs/specs/024-agents/diagram-lint.md "Where it runs"): no
// changeset was recorded, so the tab's own lint is read and answered, never "lint unavailable".

const shown: { result: Record<string, unknown>; notes: string[] }[] = [];
vi.mock('./image-result', () => ({
  imageResult: (result: Record<string, unknown>, _tab: unknown, _ctx: unknown, notes: string[]) => {
    shown.push({ result, notes });
    return { content: [{ type: 'text', text: 'stub image' }] };
  },
}));

import { registerTools } from './tools';

const TAB = { id: 't_1', name: 'Tab 1', rev: 3, elements: [] };
const REPORT: LintReport = {
  measures: {
    crossings: 0,
    behind: 0,
    overlaps: 0,
    extent: { width: 800, height: 600 },
    arrows: 0,
    boxes: 2,
  },
  findings: [
    {
      code: 'text-overflow',
      severity: 'warning',
      refs: ['bea4'],
      message: 'bea4 needs 2 lines, holds 1',
      fix: 'set bea4 height=184',
    },
  ],
  counts: { error: 0, warning: 1, info: 0 },
  skipped: { crossings: false },
};

function updateDocument(changed: boolean) {
  const lintReads: string[] = [];
  let handler: ((args: unknown, extra: unknown) => Promise<unknown>) | undefined;
  const server = {
    registerTool: (name: string, _config: unknown, h: typeof handler) => {
      if (name === 'update_document') handler = h;
    },
  } as unknown as McpServer;
  const env = {
    API: {
      fetch: async (request: Request) => {
        const url = new URL(request.url);
        const path = url.pathname.replace(/^\/api/, '');
        if (path.endsWith('/events')) return new Response(null, { status: 204 });
        if (url.searchParams.get('view') === 'lint') {
          lintReads.push(path);
          return Response.json(REPORT);
        }
        if (path.endsWith('/changesets'))
          return Response.json({
            dryRun: false,
            changeset: changed ? { id: 'cs_1', rev: 4, previousRev: 3 } : null,
            results: [],
            text: changed ? 'rev 3→4' : 'nothing changed',
            warnings: [],
            lint: changed ? REPORT : null,
          });
        if (/\/tabs\/[^/]+$/.test(path)) return Response.json({ tab: TAB });
        return Response.json({
          document: { id: 'd_1', name: 'D', tabs: [{ id: 't_1', name: 'Tab 1' }] },
        });
      },
    },
  } as unknown as Env;
  registerTools(server, env);
  return {
    lintReads,
    run: () =>
      handler!(
        { documentId: 'd_1', mode: 'edits', edits: 'set bea4 label="Same"' },
        { authInfo: { token: 'lwt_test' } },
      ),
  };
}

describe('update_document lint', () => {
  it("reads the tab's own lint when the edit changed nothing", async () => {
    shown.length = 0;
    const call = updateDocument(false);
    await call.run();
    expect(call.lintReads).toEqual(['/documents/d_1/tabs/t_1']);
    expect(shown[0]!.result.lint).toContain('1 warning');
    expect(shown[0]!.notes[0]).toContain('set bea4 height=184');
  });

  it("takes the changeset's lint when the edit changed something, reading no more", async () => {
    shown.length = 0;
    const call = updateDocument(true);
    await call.run();
    expect(call.lintReads).toEqual([]);
    expect(shown[0]!.result.lint).toContain('1 warning');
  });
});
