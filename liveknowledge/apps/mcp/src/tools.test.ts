import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MCP_TOOL_VERBS } from '@liveknowledge/agent-verbs/mcp';

// The wasm rasteriser does not load under Node; none of these tools draws.
vi.mock('./image-result', () => ({ imageResult: () => ({ content: [] }) }));

import { connectTestClient } from './mcp-test-client';

// The tools every liveworkspace app has, as this server words and answers them
// (docs/specs/015-api/mcp-server.md §4): a knowledgebase found, made, renamed, shared, deleted and restored, and a
// page renamed or deleted by its id or title.

const LONG = 'Quarterly platform migration plan for the payments team and friends';
const CAPPED = 'Quarterly platform migration plan for the payments team…';

const PAGES = {
  pages: [
    {
      tab: 'deploys',
      title: 'Deploys',
      depth: 1,
      subpages: 0,
      trust: { state: 'never-verified', stale: false },
    },
    {
      tab: 'holidays',
      title: 'Holidays',
      depth: 1,
      subpages: 0,
      trust: { state: 'never-verified', stale: false },
    },
  ],
};

type Sent = { method: string; path: string; body: Record<string, unknown> | null };

async function connect(answers: Record<string, () => Response> = {}) {
  const sent: Sent[] = [];
  const client = await connectTestClient(async (request) => {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, '');
    const text = await request.text();
    sent.push({
      method: request.method,
      path: `${path}${url.search}`,
      body: text ? (JSON.parse(text) as Record<string, unknown>) : null,
    });
    const given = answers[`${request.method} ${path}`];
    if (given) return given();
    if (path.endsWith('/pages')) return Response.json(PAGES);
    if (path.endsWith('/name'))
      return Response.json({
        tab: { id: 'deploys', name: (JSON.parse(text) as { name: string }).name },
      });
    if (path.endsWith('/share'))
      return Response.json({ link: { code: 'AB12', role: 'participate', expiresAt: null } });
    if (path === '/trash')
      return Response.json({
        trash: [
          { id: 'd9', name: 'Old', teamId: null, reason: 'deleted', trashedAt: 1, purgeAt: 2 },
        ],
      });
    if (path.endsWith('/restore')) return Response.json({ document: { id: 'd9', name: 'Old' } });
    if (request.method === 'DELETE') return new Response(null, { status: 204 });
    if (request.method === 'GET' && (path === '/documents' || path === '/teams'))
      return Response.json({ documents: [], teams: [] });
    const body = text ? (JSON.parse(text) as { id?: string; name?: string }) : {};
    return Response.json(
      { document: { id: body.id ?? 'kb', name: body.name ?? 'Handbook', tabs: [] } },
      { status: request.method === 'POST' ? 201 : 200 },
    );
  });
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: args });
    const out = (result.structuredContent ?? {}) as Record<string, unknown>;
    if (!result.isError) {
      const verb = MCP_TOOL_VERBS.find((v) => v.mcp.tool === name)!;
      z.strictObject(verb.mcpShapes.output).parse(out);
    }
    const [first] = result.content as { type: string; text: string }[];
    return { out, text: first?.text ?? '', isError: result.isError === true };
  };
  return { client, sent, call };
}

describe('the tool list', () => {
  it('opens with get_context and holds no element or layout tool', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(MCP_TOOL_VERBS.map((v) => v.mcp.tool));
    expect(tools[0]!.name).toBe('get_context');
    for (const gone of [
      'read_document',
      'update_document',
      'add_tab',
      'write_article',
      'search_icons',
      'list_versions',
      'restore_version',
      'view_tab',
      'view_live',
    ])
      expect(tools.map((t) => t.name)).not.toContain(gone);
    const words = JSON.stringify(tools);
    expect(words).not.toMatch(/wiki|knowledge base/i);
    expect(words).not.toContain('—');
  });
});

describe('create_document', () => {
  it('makes a knowledgebase and its pages in one request', async () => {
    const { call, sent } = await connect();
    const { out } = await call('create_document', {
      name: 'Handbook',
      pages: [
        { title: 'Deploys', markdown: 'On Tuesdays.' },
        { title: 'Rollbacks', markdown: 'See [[Deploys]].', parent: 'Deploys' },
      ],
      markUsed: false,
    });
    const creates = sent.filter((s) => s.method === 'POST' && s.path === '/documents');
    expect(creates).toHaveLength(1);
    const body = creates[0]!.body as { tabs: { id: string; name: string; parent?: string }[] };
    expect(body).toMatchObject({ name: 'Handbook', source: 'mcp', markUsed: false });
    expect(body.tabs.map((t) => t.name)).toEqual(['Deploys', 'Rollbacks']);
    expect(body.tabs[1]!.parent).toBe(body.tabs[0]!.id);
    expect(out).toMatchObject({
      name: 'Handbook',
      pages: [
        { page: body.tabs[0]!.id, title: 'Deploys' },
        { page: body.tabs[1]!.id, title: 'Rollbacks', parent: body.tabs[0]!.id },
      ],
    });
    expect(out.id).toBe(out.documentId);
    expect(out.url).toBe(`https://www.liveknowledge.app/document/${out.id as string}`);
    expect(out.next).toContain('create_page');
  });

  it('starts with one empty page named after the knowledgebase when no pages are given', async () => {
    const { call, sent } = await connect();
    const { out } = await call('create_document', { name: LONG });
    const body = sent.find((s) => s.path === '/documents')!.body as {
      name: string;
      tabs: { name: string }[];
    };
    // The name is shortened as the api stores it, before the tool sees it.
    expect(body.name).toBe(CAPPED);
    expect(body.tabs.map((t) => t.name)).toEqual([CAPPED]);
    expect(body).not.toHaveProperty('markUsed');
    expect((out.pages as object[]).length).toBe(1);
  });

  it('starts from a template, and refuses an unknown one by naming the kinds', async () => {
    const { call, sent } = await connect();
    const made = await call('create_document', { name: 'Notes', template: 'blank-article' });
    expect(made.isError).toBe(false);
    expect(
      (sent.find((s) => s.path === '/documents')!.body as { tabs: unknown[] }).tabs.length,
    ).toBeGreaterThan(0);
    const unknown = await call('create_document', { name: 'Notes', template: 'no-such-template' });
    expect(unknown.isError).toBe(true);
    expect(unknown.text).toContain('Unknown template "no-such-template"');
    expect(unknown.text).toContain('Valid kinds:');
  });

  it('refuses pages beside a template, and a parent that is no earlier page, before any request', async () => {
    const { call, sent } = await connect();
    const both = await call('create_document', {
      name: 'x',
      template: 'blank-article',
      pages: [{ title: 'A' }],
    });
    expect(both.text).toContain('"pages" or "template", not both');
    const orphan = await call('create_document', {
      name: 'x',
      pages: [{ title: 'A', parent: 'B' }],
    });
    expect(orphan.text).toContain('no earlier page of this call is titled "B"');
    expect(sent).toEqual([]);
  });
});

describe('rename_document', () => {
  it('renames the knowledgebase', async () => {
    const { call, sent } = await connect();
    const { out } = await call('rename_document', { documentId: 'kb', name: LONG });
    expect(sent).toEqual([{ method: 'PUT', path: '/documents/kb', body: { name: CAPPED } }]);
    expect(out).toMatchObject({ renamed: 'document', id: 'kb', name: CAPPED });
  });

  it('renames a page named by its title', async () => {
    const { call, sent } = await connect();
    const { out } = await call('rename_document', {
      documentId: 'kb',
      page: 'deploys',
      name: 'Releases',
    });
    expect(sent.map((s) => `${s.method} ${s.path}`)).toEqual([
      'GET /documents/kb/pages',
      'PUT /documents/kb/tabs/deploys/name',
    ]);
    expect(out).toEqual({ renamed: 'page', page: 'deploys', name: 'Releases' });
    const none = await call('rename_document', { documentId: 'kb', page: 'Nope', name: 'x' });
    expect(none.isError).toBe(true);
    expect(none.text).toContain('No page "Nope"');
  });
});

describe('delete_document', () => {
  it('moves the knowledgebase to the Trash', async () => {
    const { call, sent } = await connect();
    const { out } = await call('delete_document', { documentId: 'kb' });
    expect(sent).toEqual([{ method: 'DELETE', path: '/documents/kb', body: null }]);
    expect(out).toMatchObject({ deleted: 'document', documentId: 'kb', trashed: true });
  });

  it('deletes one page, named by its title', async () => {
    const { call, sent } = await connect();
    const { out } = await call('delete_document', { documentId: 'kb', page: 'Holidays' });
    expect(sent.at(-1)).toEqual({
      method: 'DELETE',
      path: '/documents/kb/tabs/holidays',
      body: null,
    });
    expect(out).toEqual({ deleted: 'page', documentId: 'kb', page: 'holidays' });
  });

  it.each([
    [409, true, 'keeps at least one page'],
    [404, true, 'list_pages lists its pages'],
    [403, true, 'needs the write scope'],
    [403, false, 'needs the write scope'],
    [410, false, 'already in the Trash'],
    [404, false, 'find_documents'],
  ])('says why a %i was refused (a page: %s)', async (status, page, words) => {
    const refuse = () => new Response('{}', { status });
    const { call } = await connect({
      'DELETE /documents/kb': refuse,
      'DELETE /documents/kb/tabs/deploys': refuse,
    });
    const { isError, text } = await call('delete_document', {
      documentId: 'kb',
      ...(page ? { page: 'deploys' } : {}),
    });
    expect(isError).toBe(true);
    expect(text).toContain(`Could not delete (${status}).`);
    expect(text).toContain(words);
  });

  it('throws on a failure of ours, for the client to retry', async () => {
    const { client } = await connect({
      'DELETE /documents/kb': () => new Response('', { status: 503 }),
    });
    const result = await client.callTool({
      name: 'delete_document',
      arguments: { documentId: 'kb' },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('503');
  });
});

describe('the other knowledgebase tools', () => {
  it('find_documents names what to call next', async () => {
    const { call } = await connect();
    const { out, isError } = await call('find_documents', { query: 'handbook' });
    expect(isError).toBe(false);
    expect(out).toMatchObject({ count: 0, documents: [] });
    expect(out.next).toContain('create_document');
  });

  it('share_document makes a Participant link unless told otherwise', async () => {
    const { call, sent } = await connect();
    const { out } = await call('share_document', { documentId: 'kb' });
    expect(sent[0]).toEqual({
      method: 'POST',
      path: '/documents/kb/share',
      body: { role: 'participate', expiry: 'never' },
    });
    expect(out).toMatchObject({
      url: 'https://www.liveknowledge.app/document/shared?s=AB12',
      role: 'participate',
    });
  });

  it('list_trash and restore_document', async () => {
    const { call } = await connect();
    const listed = await call('list_trash', {});
    expect((listed.out.trash as object[])[0]).toMatchObject({ id: 'd9', library: 'personal' });
    const restored = await call('restore_document', { documentId: 'd9' });
    expect(restored.out).toMatchObject({ restored: 'document', id: 'd9', name: 'Old' });
    const missing = await connect({
      'POST /trash/d1/restore': () => new Response('{}', { status: 404 }),
    });
    const none = await missing.call('restore_document', { documentId: 'd1' });
    expect(none.text).toContain('That knowledgebase is not in the Trash');
  });

  it('list_templates answers the catalogue', async () => {
    const { call } = await connect();
    const { out } = await call('list_templates', {});
    expect((out.templates as object[]).length).toBeGreaterThan(0);
  });
});
