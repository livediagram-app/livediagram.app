// The part of the tool-pick eval CI runs on every tool change, with no model (liveworkspace/docs/specs/021-mcp/mcp.md
// "The tool-pick eval"): every request still expects a tool its app lists, and the one MCP's calls map back to the
// app tools they run exactly as the Worker would.
import { describe, expect, it } from 'vitest';
import { REQUESTS } from '../eval/requests';
import { judge, loadWorld, missingExpectations, readCall, setupOf } from '../eval/score';

const world = loadWorld();

describe('the tool-pick eval', () => {
  it('has about 60 requests, each expecting a tool its app really lists', () => {
    expect(REQUESTS.length).toBeGreaterThanOrEqual(55);
    expect(new Set(REQUESTS.map((r) => r.id)).size).toBe(REQUESTS.length);
    expect(missingExpectations(world, REQUESTS)).toEqual([]);
  });

  it('shows the one MCP far fewer tools than the five servers', () => {
    const apps = setupOf(world, 'apps');
    const one = setupOf(world, 'one');
    expect(one.tools).toHaveLength(9);
    expect(apps.tools.length).toBeGreaterThan(140);
    expect(JSON.stringify(one.tools).length * 10).toBeLessThan(JSON.stringify(apps.tools).length);
    expect(apps.tools.every((t) => /^[a-zA-Z0-9_-]{1,64}$/.test(t.name))).toBe(true);
    expect(setupOf(world, 'one-all').tools.length).toBe(apps.tools.length + 9);
  });

  it('maps the one MCP’s calls to the app tools they run', async () => {
    const created = await readCall(world, 'one', 'create_item', { kind: 'deck', name: 'Q' });
    expect(created.calls).toEqual([
      {
        app: 'livedocuments',
        tool: 'create_document',
        args: { name: 'Q', tabs: [{ template: 'blank-slide-deck' }] },
      },
    ]);
    const used = await readCall(world, 'one', 'use_app_tool', {
      tool: 'change_cards',
      arguments: { projectId: 'P-launch' },
    });
    expect(used.calls).toEqual([
      { app: 'liveplanner', tool: 'change_items', args: { projectId: 'P-launch' } },
    ]);
    const direct = await readCall(world, 'one-all', 'update_diagram', { documentId: 'D-checkout' });
    expect(direct.calls[0]).toMatchObject({ app: 'livediagram', tool: 'update_document' });
    const listed = await readCall(world, 'one', 'list_app_tools', { kind: 'plan' });
    expect(listed.discovery).toBe(true);
    expect(listed.answer).toContain('change_cards');
    const five = await readCall(world, 'apps', 'liveplanner__change_items', {
      projectId: 'P-launch',
    });
    expect(five.calls).toEqual([
      { app: 'liveplanner', tool: 'change_items', args: { projectId: 'P-launch' } },
    ]);
    expect((await readCall(world, 'apps', 'nope', {})).calls).toEqual([]);
    expect((await readCall(world, 'one', 'nope', {})).calls).toEqual([]);
  });

  it('judges reads as neutral, a wrong change as a miss, and checks the arguments', () => {
    const request = REQUESTS.find((r) => r.id === 'share-diagram')!;
    const read = {
      app: 'livediagram' as const,
      tool: 'read_document',
      args: { documentId: 'D-checkout' },
    };
    const share = (role: string) => ({
      app: 'livediagram' as const,
      tool: 'share_document',
      args: { documentId: 'D-checkout', role },
    });
    expect(judge(request, [[read], [share('view')]])).toEqual({
      rightTool: true,
      rightArgs: true,
      calls: 2,
    });
    expect(judge(request, [[share('edit')]])).toMatchObject({ rightTool: true, rightArgs: false });
    const wrong = { app: 'livediagram' as const, tool: 'update_document', args: {} };
    expect(judge(request, [[wrong], [share('view')]])).toMatchObject({ rightTool: false, wrong });
    expect(judge(request, [[read]])).toEqual({ rightTool: false, rightArgs: false, calls: 1 });
  });
});
