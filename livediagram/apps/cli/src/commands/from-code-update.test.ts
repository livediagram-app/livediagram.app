// `link from-code --update` (docs/specs/020-import-export/infrastructure-import.md "The CLI"): a tab drawn from files
// updated from new versions of them, people's moves and labels kept, the record rewritten, refused when it can't be.

import { describe, expect, it } from 'vitest';
import { layoutGraph, type Element, type Tab } from '@livediagram/document';
import { drawnRecord, infraGraph, sourceFiles } from '@livediagram/document/infra-code';
import { run } from '../main';
import { capabilities, fakeIo, NOW, TOKEN, type Route } from '../testing/fake-io';

const DOC = 'aaaa1111-0000-4000-8000-000000000001';
const V1 = 'name = "api"\n[[kv_namespaces]]\nbinding = "CACHE"\nid = "k1"\n';
const V2 = `${V1}[[d1_databases]]\nbinding = "DB"\ndatabase_name = "main"\n`;

// The tab as the import drew it from V1, then a person moved the KV box and renamed the Worker.
function drawnTab(env?: string): Tab {
  const files = [{ name: 'wrangler.toml', text: V1 }];
  const result = infraGraph(files);
  if (!result.ok) throw new Error(result.error.message);
  const drawn = layoutGraph(result.graph);
  const edited = drawn.map((el): Element => {
    if (el.id === 'kv-k1' && el.type === 'shape') return { ...el, x: el.x + 500 };
    if (el.id === 'worker-api') return { ...el, label: 'Edge API' };
    return el;
  });
  return {
    id: 't1',
    name: 'Infra',
    elements: edited,
    sources: {
      bridge: 'infra',
      files: sourceFiles(files),
      ...(env ? { env } : {}),
      readAt: 1,
      ...drawnRecord(drawn, result.graph),
    },
  };
}

type Sent = {
  url: string;
  body: {
    replace: { elements: Element[]; layout: string; sources: Record<string, unknown> };
    base?: { rev: number };
    strict?: boolean;
  };
};

function api(tab: Tab, answer?: Response) {
  const sent: Sent[] = [];
  const route: Route = async (request, url) => {
    if (url.pathname === '/api/documents')
      return Response.json({ documents: [{ id: DOC, name: 'Shop', savedAt: NOW, ownerId: 'u' }] });
    if (url.pathname === '/api/teams') return Response.json({ teams: [] });
    if (url.pathname === `/api/documents/${DOC}`)
      return Response.json({
        document: { id: DOC, name: 'Shop', tabs: [{ id: 't1', name: 'Infra' }] },
      });
    if (request.method === 'GET' && url.pathname === `/api/documents/${DOC}/tabs/t1`)
      return new Response(JSON.stringify({ tab }), { headers: { ETag: 'W/"7"' } });
    if (url.pathname.endsWith('/changesets')) {
      sent.push({ url: url.search, body: JSON.parse(await request.text()) as Sent['body'] });
      return (
        answer ??
        Response.json({
          dryRun: url.search.includes('dryRun'),
          changeset: { id: 'cs_9', tabId: 't1', rev: 8, previousRev: 7, rebasedOver: 0 },
          results: [],
          text: '+ d1-main\nrev 7→8 · cs_9',
          warnings: [],
          lint: null,
        })
      );
    }
    return undefined;
  };
  return { sent, route };
}

async function cli(route: Route, files: Record<string, string>, argv: string[]) {
  const io = fakeIo({ env: { LIVEDIAGRAM_TOKEN: TOKEN }, routes: [capabilities, route], files });
  const code = await run(['link', 'from-code', ...argv], io);
  return { code, out: io.out(), err: io.err() };
}

describe('link from-code --update', () => {
  it('reads the files the tab remembers, keeps the moved box and the new label, and sends the record', async () => {
    const { sent, route } = api(drawnTab());
    const { code, out, err } = await cli(route, { '/work/wrangler.toml': V2 }, [
      '--doc',
      'Shop',
      '--update',
    ]);
    expect(code).toBe(0);
    expect(err).toContain('updated: added 1 box, removed 0, kept 2, 1 edit kept; lines +1 -0\n');
    expect(out).toContain('rev 7→8 · cs_9');
    const { body } = sent[0]!;
    expect(body).toMatchObject({ base: { rev: 7 }, strict: true });
    const byId = new Map(body.replace.elements.map((el) => [el.id, el]));
    const before = new Map(drawnTab().elements.map((el) => [el.id, el]));
    expect(byId.get('kv-k1')).toMatchObject({ x: (before.get('kv-k1') as { x: number }).x });
    expect(byId.get('worker-api')).toMatchObject({ label: 'Edge API' });
    expect(byId.has('d1-main')).toBe(true);
    expect(body.replace).toMatchObject({
      layout: 'preserve',
      sources: {
        bridge: 'infra',
        files: [{ name: 'wrangler.toml', text: V2 }],
        nodes: { 'd1-main': { el: 'd1-main' } },
      },
    });
    expect(body.replace.sources).not.toHaveProperty('readAt');
  });

  it('reads the files named instead, and keeps the environment the tab remembers unless --env says another', async () => {
    const staging =
      'name = "api"\n[env.staging]\n[[env.staging.r2_buckets]]\nbinding = "B"\nbucket_name = "b"\n';
    const remembered = api(drawnTab('staging'));
    const kept = await cli(remembered.route, { '/work/infra/wrangler.toml': staging }, [
      'infra/wrangler.toml',
      '--doc',
      'Shop',
      '--update',
    ]);
    expect(kept.code).toBe(0);
    expect(remembered.sent[0]!.body.replace.sources).toMatchObject({
      env: 'staging',
      files: [{ name: 'infra/wrangler.toml' }],
    });
    expect(remembered.sent[0]!.body.replace.elements.some((el) => el.id === 'r2-b')).toBe(true);
    const chosen = api(drawnTab('staging'));
    const top = await cli(chosen.route, { '/work/wrangler.toml': V2 }, [
      '--doc',
      'Shop',
      '--tab',
      'Infra',
      '--env',
      'staging',
      '--update',
    ]);
    // V2 has no staging environment: the usage error names the ones it has.
    expect(top.code).toBe(2);
    expect(top.err).toContain('No environment "staging" in this wrangler.toml');
    expect(chosen.sent).toEqual([]);
  });

  it('sends a dry run with --dry-run', async () => {
    const { sent, route } = api(drawnTab());
    const { code } = await cli(route, { '/work/wrangler.toml': V2 }, [
      '--doc',
      'Shop',
      '--update',
      '--dry-run',
    ]);
    expect(code).toBe(0);
    expect(sent[0]!.url).toBe('?dryRun=1');
  });

  it('refuses a tab not drawn from files, and a remembered file missing here', async () => {
    const plain = api({ id: 't1', name: 'Infra', elements: [] });
    const notDrawn = await cli(plain.route, {}, ['--doc', 'Shop', '--update']);
    expect(notDrawn.code).toBe(1);
    expect(notDrawn.err).toContain('tab "Infra" was not drawn from files');
    expect(notDrawn.err).toContain('livediagram link from-code <file>... --doc "Shop"');
    const missing = api(drawnTab());
    const gone = await cli(missing.route, {}, ['--doc', 'Shop', '--update']);
    expect(gone.code).toBe(3);
    expect(gone.err).toContain("can't read wrangler.toml, which the tab was drawn from");
    expect([...plain.sent, ...missing.sent]).toEqual([]);
  });

  it('is an Editor’s write: a 403 from the api is the refusal, and nothing else is sent', async () => {
    const { sent, route } = api(
      drawnTab(),
      Response.json(
        { error: 'forbidden', message: 'You can only view this document' },
        { status: 403 },
      ),
    );
    const { code, err } = await cli(route, { '/work/wrangler.toml': V2 }, [
      '--doc',
      'Shop',
      '--update',
    ]);
    expect(code).not.toBe(0);
    expect(err).toContain('forbidden');
    expect(sent).toHaveLength(1);
  });

  it('needs --doc for --update, and --update for --tab', async () => {
    const { route } = api(drawnTab());
    const noDoc = await cli(route, {}, ['--update']);
    expect(noDoc.code).toBe(2);
    expect(noDoc.err).toContain('--update needs --doc');
    const noUpdate = await cli(route, {}, ['--doc', 'Shop', '--tab', 'Infra']);
    expect(noUpdate.code).toBe(2);
    expect(noUpdate.err).toContain('--tab names the tab --update updates');
  });
});
