import { describe, expect, it, vi } from 'vitest';
// The resvg WASM renderer cannot load in plain node (see tools.test.ts); style_design never renders.
vi.mock('./image-result', () => ({ imageResult: () => ({ content: [] }) }));

import { connectTestClient } from './mcp-test-client';

// style_design end to end through a real SDK client (docs/specs/015-api/mcp-server.md §4.9g): each tab one
// tab_style change on the pages route, every tab when none is named.
const DESIGN = {
  id: 'd1',
  name: 'Brand',
  tabs: [
    { id: 't2', name: 'Icons', orderIndex: 1 },
    { id: 't1', name: 'Logos', orderIndex: 0 },
    { id: 'tx', name: 'Hidden', orderIndex: 2, outOfScope: true },
  ],
};

function api(answer: (tabId: string) => Response = (tabId) => done(tabId)) {
  const sent: { tabId: string; body: unknown }[] = [];
  const handler = async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname.replace(/^\/api/, '');
    if (path.endsWith('/events')) return new Response(null, { status: 204 });
    const pages = path.match(/\/tabs\/([^/]+)\/pages$/);
    if (pages) {
      sent.push({ tabId: pages[1]!, body: await request.json() });
      return answer(pages[1]!);
    }
    return Response.json({ design: DESIGN });
  };
  return { handler, sent };
}

const done = (tabId: string) =>
  Response.json({
    tab: { id: tabId, rev: 7 },
    lines: ['Restyled the tab.'],
    pages: [],
    changesetId: null,
  });

type Result = {
  isError?: boolean;
  content: { text: string }[];
  structuredContent?: Record<string, unknown>;
};

async function call(handler: (r: Request) => Promise<Response>, args: Record<string, unknown>) {
  const client = await connectTestClient(handler);
  return (await client.callTool({
    name: 'style_design',
    arguments: { designId: 'd1', ...args },
  })) as Result;
}

describe('style_design', () => {
  it('restyles every tab it can reach, in tab order, when no tab is named', async () => {
    const { handler, sent } = api();
    const out = await call(handler, { theme: 'forest', finish: 'sketch' });
    expect(out.isError).toBeFalsy();
    expect(sent).toEqual([
      { tabId: 't1', body: { pages: [{ op: 'tab_style', theme: 'forest', finish: 'sketch' }] } },
      { tabId: 't2', body: { pages: [{ op: 'tab_style', theme: 'forest', finish: 'sketch' }] } },
    ]);
    expect(out.structuredContent).toMatchObject({
      designId: 'd1',
      tabs: [
        { tabId: 't1', name: 'Logos', rev: 7 },
        { tabId: 't2', name: 'Icons', rev: 7 },
      ],
      lines: [
        'Restyled tab "Logos": theme forest, finish sketch.',
        'Restyled tab "Icons": theme forest, finish sketch.',
      ],
    });
  });

  it('restyles only the tab named, font included', async () => {
    const { handler, sent } = api();
    const out = await call(handler, { tabId: 't2', font: 'poppins' });
    expect(out.isError).toBeFalsy();
    expect(sent).toEqual([
      { tabId: 't2', body: { pages: [{ op: 'tab_style', font: 'poppins' }] } },
    ]);
  });

  it('refuses a call with nothing to change, before any request', async () => {
    const { handler, sent } = api();
    const out = await call(handler, {});
    expect(out.isError).toBe(true);
    expect(out.content[0]!.text).toBe('Give at least one of theme, finish or font.');
    expect(sent).toEqual([]);
  });

  it('refuses an unknown theme or font naming the valid ones', async () => {
    const { handler, sent } = api();
    const theme = await call(handler, { theme: 'Forest' });
    expect(theme.isError).toBe(true);
    expect(theme.content[0]!.text).toMatch(/Unknown theme\. One of: .*forest/);
    const font = await call(handler, { font: 'comic' });
    expect(font.isError).toBe(true);
    expect(font.content[0]!.text).toMatch(/Unknown font\. One of: .*poppins/);
    expect(sent).toEqual([]);
  });

  it('names the tabs when the one named is not there', async () => {
    const { handler } = api();
    const out = await call(handler, { tabId: 'nope', theme: 'forest' });
    expect(out.isError).toBe(true);
    expect(out.content[0]!.text).toBe(
      'No tab "nope" in this design. Tabs: Logos (t1), Icons (t2).',
    );
  });

  it('stops at a refused tab, naming it and the tabs restyled before it', async () => {
    const { handler } = api((tabId) =>
      tabId === 't2'
        ? Response.json(
            { error: 'tab_locked', message: 'That tab is locked: unlock it in the editor first.' },
            { status: 400 },
          )
        : done(tabId),
    );
    const out = await call(handler, { theme: 'forest' });
    expect(out.isError).toBe(true);
    expect(out.content[0]!.text).toBe(
      'Tab "Icons": That tab is locked: unlock it in the editor first. Restyled before it: "Logos".',
    );
  });
});
