import { describe, expect, it } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { fileAddedTab, registerTabFolderTools } from './tab-folder-tools';

// change_tabs and add_tab's `folder` (docs/specs/006-design/tab-folders.md "Agents"): every change planned over the
// tabs as they are, then one tab-order write the api relays to everyone with the design open.

type Tab = { id: string; name: string; orderIndex: number; folder?: string };
type Registered = { name: string; handler: (args: unknown, extra: unknown) => Promise<unknown> };
const AUTHED = { authInfo: { token: 'tok_test' } };

const TABS: Tab[] = [
  { id: 't1', name: 'Overview', orderIndex: 0 },
  { id: 't2', name: 'Goals', orderIndex: 1, folder: 'Plans' },
  { id: 't3', name: 'Risks', orderIndex: 2, folder: 'Plans' },
  { id: 't4', name: 'Notes', orderIndex: 3 },
];

// A design the api holds: a read answers its tabs, a tab-order write applies (or, with `status`, is refused).
function harness(status = 200, start: Tab[] = TABS) {
  let tabs = start;
  const writes: unknown[] = [];
  const env = {
    API: {
      fetch: async (request: Request) => {
        const url = new URL(request.url);
        if (url.pathname.endsWith('/events')) return new Response(null, { status: 204 });
        if (request.method === 'PUT') {
          const body = await request.json<{ tabs: { id: string; folder: string | null }[] }>();
          writes.push(body);
          if (status !== 200) return Response.json({ error: 'forbidden' }, { status });
          tabs = body.tabs.map((t, i) => {
            const name = tabs.find((x) => x.id === t.id)!.name;
            return { id: t.id, name, orderIndex: i, ...(t.folder ? { folder: t.folder } : {}) };
          });
        }
        return Response.json({ design: { id: 'f1', name: 'Roadmap', tabs } });
      },
    },
  } as unknown as Env;
  const registered: Registered[] = [];
  const server = {
    registerTool: (name: string, _config: unknown, handler: Registered['handler']) => {
      registered.push({ name, handler });
    },
  } as unknown as McpServer;
  registerTabFolderTools(server, env);
  const changeTabs = (changes: unknown[]) =>
    registered[0]!.handler({ designId: 'f1', changes }, AUTHED) as Promise<{
      isError?: boolean;
      content: { text: string }[];
      structuredContent?: { applied: string[]; tabs: { name: string; folder?: string }[] };
    }>;
  return { env, writes, changeTabs, registered };
}

const bar = (tabs: { name: string; folder?: string }[]) =>
  tabs.map((t) => (t.folder ? `${t.folder}/${t.name}` : t.name));

describe('change_tabs', () => {
  it('is registered as change_tabs', () => {
    expect(harness().registered.map((r) => r.name)).toEqual(['change_tabs']);
  });

  it('moves a tab into a folder, as its last tab, nothing else moving', async () => {
    const { changeTabs, writes } = harness();
    const answer = await changeTabs([{ op: 'move', tab: 'Notes', folder: 'Plans' }]);
    expect(answer.structuredContent!.applied).toEqual(['~ tab "Notes" into folder "Plans"']);
    expect(bar(answer.structuredContent!.tabs)).toEqual([
      'Overview',
      'Plans/Goals',
      'Plans/Risks',
      'Plans/Notes',
    ]);
    expect(writes).toHaveLength(1);
  });

  it('takes a tab out of its folder, renames a folder and ungroups one', async () => {
    const { changeTabs } = harness();
    const out = await changeTabs([{ op: 'move', tab: 't3', folder: null }]);
    expect(bar(out.structuredContent!.tabs)).toEqual(['Overview', 'Plans/Goals', 'Risks', 'Notes']);
    const renamed = await changeTabs([{ op: 'rename_folder', folder: 'Plans', to: 'Planning' }]);
    expect(bar(renamed.structuredContent!.tabs)).toEqual([
      'Overview',
      'Planning/Goals',
      'Risks',
      'Notes',
    ]);
    const ungrouped = await changeTabs([{ op: 'ungroup', folder: 'Planning' }]);
    expect(bar(ungrouped.structuredContent!.tabs)).toEqual(['Overview', 'Goals', 'Risks', 'Notes']);
  });

  it('refuses an unknown tab in words, writing nothing', async () => {
    const { changeTabs, writes } = harness();
    const answer = await changeTabs([{ op: 'move', tab: 'Budget', folder: 'Plans' }]);
    expect(answer.isError).toBe(true);
    expect(answer.content[0]!.text).toContain('No tab "Budget". Tabs: Overview (t1)');
    expect(writes).toEqual([]);
  });

  it('refuses a Viewer: only an Editor changes tab folders', async () => {
    const { changeTabs } = harness(403);
    const answer = await changeTabs([{ op: 'ungroup', folder: 'Plans' }]);
    expect(answer.isError).toBe(true);
    expect(answer.content[0]!.text).toBe(
      'Only an Editor can change tab folders, and you can only view or participate in this design.',
    );
  });

  it('throws what is not a refusal', async () => {
    const { changeTabs } = harness(500);
    await expect(changeTabs([{ op: 'ungroup', folder: 'Plans' }])).rejects.toThrow();
  });
});

describe('add_tab’s folder', () => {
  const added: Tab[] = [...TABS, { id: 't5', name: 'Budget', orderIndex: 4 }];

  it('joins an existing folder as its last tab, or starts a new one at the end', async () => {
    const existing = harness(200, added);
    expect(await fileAddedTab(existing.env, 'tok', 'f1', 't5', 'Plans')).toEqual({
      folder: 'Plans',
    });
    expect(existing.writes).toEqual([
      {
        tabs: [
          { id: 't1', folder: null },
          { id: 't2', folder: 'Plans' },
          { id: 't3', folder: 'Plans' },
          { id: 't5', folder: 'Plans' },
          { id: 't4', folder: null },
        ],
      },
    ]);
    const fresh = harness(200, added);
    expect(await fileAddedTab(fresh.env, 'tok', 'f1', 't5', 'Money')).toEqual({ folder: 'Money' });
    expect((fresh.writes[0] as { tabs: unknown[] }).tabs.at(-1)).toEqual({
      id: 't5',
      folder: 'Money',
    });
  });

  it('does nothing without a folder, keeps the tab when it cannot be filed, and throws the rest', async () => {
    const { env, writes } = harness(200, added);
    expect(await fileAddedTab(env, 'tok', 'f1', 't5', undefined)).toEqual({});
    expect(writes).toEqual([]);
    const viewer = harness(403, added);
    expect((await fileAddedTab(viewer.env, 'tok', 'f1', 't5', 'Plans')).refused).toMatch(
      /^The tab was made, but not put in a folder: Only an Editor/,
    );
    const broken = harness(500, added);
    await expect(fileAddedTab(broken.env, 'tok', 'f1', 't5', 'Plans')).rejects.toThrow();
  });
});
