import { describe, expect, it, vi } from 'vitest';
// The resvg WASM renderer cannot load in plain node (see tools.test.ts); the Illustrate tools never render.
vi.mock('./image-result', () => ({ imageResult: () => ({ content: [] }) }));

import { connectTestClient } from './mcp-test-client';

// The Illustrate tools end to end through a real SDK client (docs/specs/024-agents/illustrate-for-agents.md): a
// mistake the caller can fix is a tool error in words, naming the change it stopped at.
const LIVE_DOC = { id: 'd1', name: 'Deck', tabs: [{ id: 't1', name: 'Slides', orderIndex: 0 }] };
const TAB = { id: 't1', name: 'Slides', rev: 3, opensIn: 'illustrate', elements: [] };
const ARTICLE = { flow: 'art-1', title: 'Brief', pages: [1], blocks: 2, words: 3, look: null };

function api(answer: (body: unknown) => Response) {
  const sent: unknown[] = [];
  const handler = async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname.replace(/^\/api/, '');
    if (path.endsWith('/events')) return new Response(null, { status: 204 });
    if (path.endsWith('/illustrate')) {
      const body = await request.json();
      sent.push(body);
      return answer(body);
    }
    if (/\/tabs\/[^/]+$/.test(path)) return Response.json({ tab: TAB });
    return Response.json({ document: LIVE_DOC });
  };
  return { handler, sent };
}

const done = (extra: Record<string, unknown> = {}) =>
  Response.json({
    tab: { id: 't1', rev: 4 },
    switched: false,
    lines: ['Wrote it.'],
    pages: [],
    articles: [ARTICLE],
    changesetId: null,
    ...extra,
  });

type Result = {
  isError?: boolean;
  content: { text: string }[];
  structuredContent?: Record<string, unknown>;
};

async function call(
  handler: (r: Request) => Promise<Response>,
  name: string,
  args: Record<string, unknown>,
) {
  const client = await connectTestClient(handler);
  return (await client.callTool({ name, arguments: { documentId: 'd1', ...args } })) as Result;
}

describe('the Illustrate tools', () => {
  it('change pages on the first Illustrate tab and answer the pages', async () => {
    const { handler, sent } = api(() => done());
    const out = await call(handler, 'change_pages', { changes: [{ op: 'add', kind: 'slide' }] });
    expect(out.isError).toBeFalsy();
    expect(sent).toEqual([{ pages: [{ op: 'add', kind: 'slide' }] }]);
    expect(out.structuredContent).toMatchObject({ tabId: 't1', rev: 4, lines: ['Wrote it.'] });
  });

  it('name the change a refusal stopped at, counting from 1', async () => {
    const { handler } = api(() =>
      Response.json({ error: 'page_unknown', message: 'No page "9".', change: 1 }, { status: 400 }),
    );
    const out = await call(handler, 'change_pages', {
      changes: [
        { op: 'add', kind: 'slide' },
        { op: 'delete', page: 9 },
      ],
    });
    expect(out.isError).toBe(true);
    expect(out.content[0]!.text).toBe('Change 2: No page "9".');
  });

  it('write an article, sending only what was given', async () => {
    const { handler, sent } = api(() => done({ article: { ...ARTICLE, created: true } }));
    const out = await call(handler, 'write_article', { markdown: '# Brief', look: 'report' });
    expect(sent).toEqual([{ article: { markdown: '# Brief', look: 'report' } }]);
    expect(out.structuredContent).toMatchObject({ article: { flow: 'art-1', created: true } });
  });

  it('say so when the write cannot be read back, or is refused', async () => {
    const lost = api(() => done());
    expect(
      (await call(lost.handler, 'write_article', { markdown: 'x' })).content[0]!.text,
    ).toContain('could not be read back');
    const refused = api(() =>
      Response.json({ error: 'article_ambiguous', message: 'Name one.' }, { status: 400 }),
    );
    const out = await call(refused.handler, 'write_article', { markdown: 'x' });
    expect(out).toMatchObject({ isError: true, content: [{ text: 'Name one.' }] });
  });
});
