// `link from-code` (docs/specs/020-import-export/infrastructure-import.md "The CLI"): the files found or named, the
// summary on stderr, the graph on a dry run, and a new document or a tab sent through the write verbs.

import { describe, expect, it } from 'vitest';
import { run } from '../main';
import { capabilities, fakeIo, NOW, TOKEN, type Route } from '../testing/fake-io';

const DOC = 'aaaa1111-0000-4000-8000-000000000001';

const WRANGLER = `name = "api"
[[kv_namespaces]]
binding = "CACHE"
id = "k1"
[vars]
A = "1"
`;
const COMPOSE = `services:
  web: { image: nginx, depends_on: [db] }
  db: { image: postgres }
`;

async function cli(io: ReturnType<typeof fakeIo>, argv: string[]) {
  const code = await run(argv, io);
  return { code, out: io.out(), err: io.err() };
}

const offline = (files: Record<string, string>) => fakeIo({ files });

describe('link from-code --dry-run', () => {
  it('reads the standard files here and prints the graph, with the summary on stderr', async () => {
    const io = offline({ '/work/wrangler.toml': WRANGLER, '/work/compose.yml': COMPOSE });
    const { code, out, err } = await cli(io, ['link', 'from-code', '--dry-run']);
    expect(code).toBe(0);
    const graph = JSON.parse(out) as { title: string; subtitle: string; nodes: { id: string }[] };
    expect(graph.title).toBe('api, Compose');
    expect(graph.subtitle).toBe('From wrangler.toml, compose.yml');
    expect(graph.nodes.map((n) => n.id)).toEqual(['worker-api', 'kv-k1', 'svc-web', 'svc-db']);
    expect(err).toBe(
      'read wrangler.toml: wrangler.toml, 2 boxes\nread compose.yml: Compose, 2 boxes\nskipped keys: vars\n',
    );
  });

  it('reads the .tf files here after the standard names, and names Kubernetes files', async () => {
    const io = offline({
      '/work/compose.yml': 'services:\n  web: {}\n',
      '/work/queues.tf': 'resource "aws_sqs_queue" "jobs" {}\n',
      '/work/main.tf': 'resource "aws_s3_bucket" "assets" {}\n',
      '/work/k8s/web.yaml': 'apiVersion: v1\nkind: Service\nmetadata: { name: web }\n',
      '/work/notes.md': '# not read',
    });
    const found = await cli(io, ['link', 'from-code', '--dry-run']);
    expect(found.code).toBe(0);
    // The standard names first, then the .tf files in name order; nothing else in the folder.
    expect(found.err).toBe(
      'read compose.yml: Compose, 1 box\nread main.tf: Terraform, 1 box\nread queues.tf: Terraform, 1 box\n',
    );
    const named = await cli(
      offline({
        '/work/main.tf': 'resource "aws_s3_bucket" "assets" {}\n',
        '/work/k8s/web.yaml': 'apiVersion: v1\nkind: Service\nmetadata: { name: web }\n',
      }),
      ['link', 'from-code', 'main.tf', 'k8s/web.yaml', '--dry-run'],
    );
    expect(named.code).toBe(0);
    expect(named.err).toBe(
      'read main.tf: Terraform, 1 box\nread k8s/web.yaml: Kubernetes, 1 box\n',
    );
  });

  it('reads named files, relative or absolute, and draws a chosen environment', async () => {
    const io = offline({
      '/work/apps/api/wrangler.toml': 'name = "api"\n[env.staging]\nname = "api-staging"\n',
      '/elsewhere/compose.yml': 'services:\n  edge: {}\n',
    });
    const { code, out, err } = await cli(io, [
      'link',
      'from-code',
      'apps/api/wrangler.toml',
      '/elsewhere/compose.yml',
      '--env',
      'staging',
      '--dry-run',
    ]);
    expect(code).toBe(0);
    expect((JSON.parse(out) as { title: string }).title).toBe('api-staging, elsewhere');
    expect(err).toBe(
      'read apps/api/wrangler.toml: wrangler.toml, 1 box\nread /elsewhere/compose.yml: Compose, 1 box\n',
    );
  });

  it('says what it left out of a large system', async () => {
    const lines = ['services:'];
    for (let i = 0; i < 160; i++) lines.push(`  s${i}: { depends_on: [${i ? `s${i - 1}` : ''}] }`);
    const io = offline({ '/work/compose.yml': lines.join('\n') });
    const { code, err } = await cli(io, ['link', 'from-code', '--dry-run']);
    expect(code).toBe(0);
    expect(err).toContain('left out: 11 boxes past the first 149, listed in the last box\n');
  });

  it('says how many lines it left out past the graph builder’s cap', async () => {
    const lines = ['services:'];
    for (let i = 0; i < 46; i++)
      lines.push(
        `  s${i}: { depends_on: [${Array.from({ length: i }, (_, j) => `s${j}`).join(', ')}] }`,
      );
    const io = offline({ '/work/compose.yml': lines.join('\n') });
    const { err } = await cli(io, ['link', 'from-code', '--dry-run']);
    expect(err).toContain('left out: 35 lines past the first 1000\n');
  });

  it('refuses when there is nothing to read', async () => {
    const io = offline({});
    const { code, err } = await cli(io, ['link', 'from-code', '--dry-run']);
    expect(code).toBe(2);
    expect(err).toContain(
      'no wrangler.toml, docker-compose.yml, docker-compose.yaml, compose.yml, compose.yaml or .tf file in /work',
    );
    const missing = await cli(offline({}), ['link', 'from-code', 'nope.toml', '--dry-run']);
    expect(missing.code).toBe(3);
    expect(missing.err).toContain("can't read nope.toml");
  });

  it('refuses a file past the cap, named or found', async () => {
    const big = `# ${'x'.repeat(1_000_001)}`;
    for (const argv of [['wrangler.toml'], []]) {
      const io = offline({ '/work/wrangler.toml': big });
      const { code, err } = await cli(io, ['link', 'from-code', ...argv, '--dry-run']);
      expect(code).toBe(1);
      expect(err).toContain('wrangler.toml is over 1 MB');
    }
  });

  it('names the file a parse error is in, and a usage error without one', async () => {
    const io = offline({ '/work/compose.yml': 'services: [' });
    const parse = await cli(io, ['link', 'from-code', '--dry-run']);
    expect(parse.code).toBe(1);
    expect(parse.err).toMatch(/compose\.yml: Couldn't read the YAML: /);
    const env = await cli(offline({ '/work/wrangler.toml': WRANGLER }), [
      'link',
      'from-code',
      '--env',
      'prod',
      '--dry-run',
    ]);
    expect(env.code).toBe(2);
    expect(env.err).toContain(
      'wrangler.toml: No environment "prod" in this wrangler.toml; it has none.',
    );
    const files = Object.fromEntries(
      Array.from({ length: 21 }, (_, i) => [`/work/w${i}.toml`, 'name = "a"']),
    );
    const many = await cli(offline(files), [
      'link',
      'from-code',
      ...Object.keys(files).map((f) => f.slice(6)),
      '--dry-run',
    ]);
    expect(many.code).toBe(2);
    expect(many.err).toContain('Up to 20 files can be drawn at once.');
  });
});

describe('link from-code, writing', () => {
  const session = (route: Route, files: Record<string, string>) =>
    fakeIo({ env: { LIVEDIAGRAM_TOKEN: TOKEN }, routes: [capabilities, route], files });

  it('creates a document named by the drawing, its tab the graph', async () => {
    const posted: { name: string; tabs: { name: string; graph: { title: string } }[] }[] = [];
    const route: Route = async (request, url) => {
      if (url.pathname !== '/api/documents' || request.method !== 'POST') return undefined;
      const body = JSON.parse(await request.text()) as (typeof posted)[number] & { id: string };
      posted.push(body);
      return Response.json(
        { document: { id: body.id, name: body.name, tabs: body.tabs } },
        { status: 201 },
      );
    };
    const io = session(route, { '/work/wrangler.toml': WRANGLER });
    const { code, out, err } = await cli(io, ['link', 'from-code']);
    expect(code).toBe(0);
    // The tab remembers the files it was drawn from (diagram-sources.md "Writing the record").
    expect(posted[0]).toMatchObject({
      name: 'api',
      tabs: [
        {
          name: 'api',
          graph: { title: 'api' },
          sources: { bridge: 'infra', files: [{ name: 'wrangler.toml', text: WRANGLER }] },
        },
      ],
    });
    expect(err).toMatch(/update later: livediagram link from-code --doc \S+ --update\n$/);
    expect(out).toMatch(
      /^\+ document \w{8} "api" · 1 tab · https:\/\/www\.livediagram\.app\/document\//,
    );
    const named = await cli(session(route, { '/work/wrangler.toml': WRANGLER }), [
      'link',
      'from-code',
      '--name',
      'Edge',
      '--json',
    ]);
    expect(posted[1]!.name).toBe('Edge');
    expect(JSON.parse(named.out)).toMatchObject({ id: expect.any(String) });
  });

  it('adds a tab to --doc through tab add', async () => {
    const sent: { replace?: { name: string; graph: unknown } }[] = [];
    const unrouted: string[] = [];
    const route: Route = async (request, url) => {
      if (url.pathname === '/api/documents')
        return Response.json({
          documents: [{ id: DOC, name: 'Shop', savedAt: NOW, ownerId: 'u' }],
        });
      if (url.pathname === '/api/teams') return Response.json({ teams: [] });
      if (url.pathname === `/api/documents/${DOC}`)
        return Response.json({ document: { id: DOC, name: 'Shop', tabs: [] } });
      // The tab read back after the write, for the CLI's read copy.
      if (request.method === 'GET' && url.pathname.startsWith(`/api/documents/${DOC}/tabs/`))
        return new Response(JSON.stringify({ tab: { id: 't', name: 'Compose', elements: [] } }), {
          headers: { ETag: 'W/"1"' },
        });
      if (url.pathname.endsWith('/changesets')) {
        sent.push(JSON.parse(await request.text()) as (typeof sent)[number]);
        return Response.json({
          dryRun: false,
          changeset: { id: 'cs_1', tabId: 't', rev: 1, previousRev: 0, rebasedOver: 0 },
          results: [],
          text: `+ 5 elements\nrev 0→1 · cs_1 · lint clean · revert: livediagram changeset revert ${DOC} cs_1`,
          warnings: [],
          lint: null,
        });
      }
      unrouted.push(`${request.method} ${url.pathname}`);
      return undefined;
    };
    const io = session(route, { '/work/compose.yml': COMPOSE });
    const { code, out, err } = await cli(io, ['link', 'from-code', '--doc', 'Shop', '--env', 'x']);
    expect(unrouted).toEqual([]);
    expect(code).toBe(0);
    expect(sent[0]!.replace).toMatchObject({
      name: 'Compose',
      graph: { title: 'Compose' },
      sources: { bridge: 'infra', env: 'x', files: [{ name: 'compose.yml' }] },
    });
    expect(out).toMatch(/^\+ tab /);
    expect(err).toMatch(
      /update later: livediagram link from-code --doc "Shop" --tab \S+ --update\n$/,
    );
    const quiet = await cli(session(route, { '/work/compose.yml': COMPOSE }), [
      'link',
      'from-code',
      '--doc',
      'Shop',
      '-q',
    ]);
    expect(quiet.out).toBe('cs_1\n');
  });
});
