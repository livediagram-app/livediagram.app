import { describe, expect, it, vi } from 'vitest';
// The resvg WASM renderer cannot load in plain node (see tools.test.ts).
vi.mock('./image-result', () => ({
  imageResult: (value: Record<string, unknown>) => ({
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: value,
  }),
}));

import { connectTestClient } from './mcp-test-client';

// style_project (docs/specs/015-api/mcp-server.md §4.4b): each tab one style changeset, every tab when none is named.

type Sent = { tabId: string; body: Record<string, unknown> };

async function connect(refuse?: string) {
  const sent: Sent[] = [];
  let rev = 4;
  const client = await connectTestClient(async (request) => {
    const path = new URL(request.url).pathname.replace(/^\/api/, '');
    if (path === '/projects/d1')
      return Response.json({
        project: {
          id: 'd1',
          name: 'Launch',
          tabs: [
            { id: 'b1', name: 'Board', orderIndex: 0 },
            { id: 'f1', name: 'Signup', orderIndex: 1 },
          ],
        },
      });
    const m = /^\/projects\/d1\/tabs\/([^/]+)\/changesets$/.exec(path);
    if (m && request.method === 'POST') {
      if (m[1] === refuse)
        return Response.json(
          { error: 'tab_busy', message: 'the tab kept changing' },
          { status: 409 },
        );
      sent.push({ tabId: m[1]!, body: await request.json<Record<string, unknown>>() });
      rev += 1;
      return Response.json({
        dryRun: false,
        changeset: { id: `cs${rev}`, tabId: m[1], rev, previousRev: rev - 1, rebasedOver: 0 },
        results: [],
        text: '',
        warnings: [],
      });
    }
    return Response.json({ error: 'not_found' }, { status: 404 });
  });
  return { client, sent };
}

const textOf = (r: Record<string, unknown>) => (r.content as { text: string }[])[0]!.text;

describe('style_project', () => {
  it('restyles every tab when none is named, the style reaching the api as sent', async () => {
    const { client, sent } = await connect();
    const r = await client.callTool({
      name: 'style_project',
      arguments: { projectId: 'd1', theme: 'forest', finish: 'sketch' },
    });
    expect(r.isError).toBeFalsy();
    expect(sent).toEqual([
      { tabId: 'b1', body: { style: { theme: 'forest', finish: 'sketch' } } },
      { tabId: 'f1', body: { style: { theme: 'forest', finish: 'sketch' } } },
    ]);
    expect(r.structuredContent).toEqual({
      projectId: 'd1',
      tabs: [
        { tabId: 'b1', name: 'Board', rev: 5 },
        { tabId: 'f1', name: 'Signup', rev: 6 },
      ],
      lines: [
        'Restyled tab "Board": theme forest, finish sketch.',
        'Restyled tab "Signup": theme forest, finish sketch.',
      ],
    });
  });

  it('restyles one tab, named by id or by name', async () => {
    const { client, sent } = await connect();
    await client.callTool({
      name: 'style_project',
      arguments: { projectId: 'd1', tabId: 'Signup', font: 'inter' },
    });
    expect(sent).toEqual([{ tabId: 'f1', body: { style: { font: 'inter' } } }]);
    const r = await client.callTool({
      name: 'style_project',
      arguments: { projectId: 'd1', tabId: 'nope', font: 'inter' },
    });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toBe('No tab "nope" in this plan. Tabs: Board (b1), Signup (f1).');
  });

  it('refuses no style, an unknown theme and an unknown font before any write, naming the valid ones', async () => {
    const { client, sent } = await connect();
    const call = (args: Record<string, unknown>) =>
      client.callTool({ name: 'style_project', arguments: { projectId: 'd1', ...args } });
    const none = await call({});
    expect(none.isError).toBe(true);
    expect(textOf(none)).toBe('Give a "theme", a "finish" or a "font".');
    const theme = await call({ theme: 'nope' });
    expect(textOf(theme)).toMatch(/^Unknown theme "nope"\. Themes: .*forest/);
    const font = await call({ font: 'comic' });
    expect(textOf(font)).toMatch(/^Unknown font "comic"\. Fonts: .*inter/);
    const finish = await call({ finish: 'crayon' });
    expect(finish.isError).toBe(true);
    expect(sent).toEqual([]);
  });

  it('stops at a refused tab, saying which were restyled before it', async () => {
    const { client } = await connect('f1');
    const r = await client.callTool({
      name: 'style_project',
      arguments: { projectId: 'd1', theme: 'ocean' },
    });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain('Tab "Signup":');
    expect(textOf(r)).toContain('Restyled tab "Board": theme ocean.');
  });
});
