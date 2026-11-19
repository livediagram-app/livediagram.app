import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { layoutGraph } from '../graph-input';
import { infraGraph, skippedLine } from './index';
import { capNodes, groupByPrefix, MORE_NODE_ID } from './large';
import { INFRA_GROUP_FROM, INFRA_MAX_FILES, INFRA_MAX_NODES } from './limits';
import { slug } from './part';
import { mergeSkipped } from './summary';

const ok = (result: ReturnType<typeof infraGraph>) => {
  if (!result.ok) throw new Error(result.error.message);
  return result;
};

// A Compose file of `n` services in twelve name families, each depending on the one before.
function bigCompose(n: number): string {
  const lines = ['services:'];
  for (let i = 0; i < n; i++) {
    lines.push(`  fam${i % 12}-svc${i}:`, `    image: ${i % 5 === 0 ? 'postgres' : 'acme/app'}:1`);
    if (i > 0) lines.push(`    depends_on: [fam${(i - 1) % 12}-svc${i - 1}]`);
  }
  return lines.join('\n');
}

describe('infraGraph', () => {
  it('draws one wrangler.toml with its title and source', () => {
    const result = ok(
      infraGraph([
        { name: 'wrangler.toml', text: 'name = "api"\n[ai]\nbinding = "AI"\n[vars]\nA = 1' },
      ]),
    );
    expect(result.graph).toMatchObject({
      title: 'api',
      subtitle: 'From wrangler.toml',
      style: 'flow',
      edges: [{ from: 'worker-api', to: 'ai' }],
    });
    expect(result.files).toEqual([{ name: 'wrangler.toml', format: 'wrangler', boxes: 2 }]);
    expect(result.skipped).toEqual([{ key: 'vars', count: 1 }]);
    expect(result.leftOut).toBe(0);
    expect(result.graph.groups).toBeUndefined();
  });

  it('merges several files into one system by resource', () => {
    const result = ok(
      infraGraph([
        {
          name: 'apps/web/wrangler.toml',
          text: '[[services]]\nbinding = "API"\nservice = "api"\n[vars]\nX=1',
        },
        {
          name: 'apps/api/wrangler.toml',
          text: 'name = "api"\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "db"\n[vars]\nY=2',
        },
      ]),
    );
    // The first file has no name: its folder names it. The api Worker is one box, bound from web.
    expect(result.graph.nodes.map((n) => n.id)).toEqual(['worker-web', 'worker-api', 'd1-db']);
    expect(result.graph.edges.map((e) => `${e.from}>${e.to}`)).toEqual([
      'worker-web>worker-api',
      'worker-api>d1-db',
    ]);
    expect(result.graph.title).toBe('web, api');
    expect(result.graph.subtitle).toBe('From apps/web/wrangler.toml, apps/api/wrangler.toml');
    expect(result.skipped).toEqual([{ key: 'vars', count: 2 }]);
  });

  it('names a paste by its format and titles many files with a count', () => {
    const paste = ok(infraGraph([{ text: 'services:\n  web: {}' }]));
    expect(paste.graph).toMatchObject({ title: 'Compose', subtitle: 'From docker-compose.yml' });
    expect(ok(infraGraph([{ text: 'name = "w"' }])).graph.subtitle).toBe('From wrangler.toml');
    const many = ok(
      infraGraph(
        ['a', 'b', 'c', 'd'].map((n) => ({ name: `${n}/wrangler.toml`, text: `name = "${n}"` })),
      ),
    );
    expect(many.graph.title).toBe('a, b and 2 more');
  });

  it('draws all four formats together into one system', () => {
    const result = ok(
      infraGraph([
        { name: 'apps/api/wrangler.toml', text: 'name = "api"\n[ai]\nbinding = "AI"' },
        { name: 'compose.yml', text: 'services:\n  db:\n    image: postgres' },
        { name: 'infra/main.tf', text: 'resource "aws_s3_bucket" "b" {}' },
        { name: 'k8s/web.yaml', text: 'apiVersion: v1\nkind: Service\nmetadata: { name: web }' },
        { text: 'resource "aws_sqs_queue" "q" {}' },
        { text: 'kind: Pod\napiVersion: v1\nmetadata: { name: p }' },
      ]),
    );
    expect(result.files.map((f) => [f.name, f.format, f.boxes])).toEqual([
      ['apps/api/wrangler.toml', 'wrangler', 2],
      ['compose.yml', 'compose', 1],
      ['infra/main.tf', 'terraform', 1],
      ['k8s/web.yaml', 'kubernetes', 1],
      ['main.tf', 'terraform', 1],
      ['manifest.yaml', 'kubernetes', 1],
    ]);
    // Each part is named by its folder, else its format's word.
    expect(result.graph.title).toBe('api, Compose and 4 more');
    expect(result.graph.nodes).toHaveLength(7);
  });

  it('draws the chosen environment where a file has it, the top level where it has not', () => {
    const files = [
      {
        name: 'apps/api/wrangler.toml',
        text: 'name = "api"\n[env.staging]\nname = "api-staging"\n[env.prod]\nname = "api-prod"',
      },
      { name: 'apps/web/wrangler.toml', text: 'name = "web"' },
      { name: 'compose.yml', text: 'services:\n  db: {}' },
    ];
    const result = ok(infraGraph(files, { env: 'staging' }));
    expect(result.graph.nodes.map((n) => n.id)).toEqual([
      'worker-api-staging',
      'worker-web',
      'svc-db',
    ]);
    expect(result.skipped).toEqual([{ key: 'env.staging not in web', count: 1 }]);
    // No file has it: the first wrangler.toml says which environments it has.
    expect(infraGraph(files, { env: 'qa' })).toMatchObject({
      ok: false,
      error: { code: 'unknown-env', file: 'apps/api/wrangler.toml' },
    });
  });

  it('draws a line two files both give once', () => {
    const text = '[[services]]\nbinding = "A"\nservice = "auth"';
    const result = ok(
      infraGraph([
        { name: 'a/wrangler.toml', text: `name = "web"\n${text}` },
        { name: 'b/wrangler.toml', text: `name = "web"\n${text}` },
      ]),
    );
    expect(result.graph.edges).toEqual([{ from: 'worker-web', to: 'worker-auth' }]);
  });

  it('merges network frames two Compose files share', () => {
    const one = 'services:\n  web: { networks: [front] }';
    const two = 'services:\n  app: { networks: [front] }';
    const result = ok(
      infraGraph([
        { name: 'compose.yml', text: one },
        { name: 'more/compose.yml', text: two },
      ]),
    );
    expect(result.graph.groups).toEqual([
      { id: 'net-front', label: 'front network', members: ['svc-web', 'svc-app'] },
    ]);
  });

  it('stops at the first file that cannot be drawn, naming it', () => {
    expect(
      infraGraph([
        { name: 'wrangler.toml', text: 'name = "a"' },
        { name: 'bad/compose.yml', text: 'services: [' },
      ]),
    ).toMatchObject({ ok: false, error: { code: 'parse', file: 'bad/compose.yml' } });
    expect(infraGraph([{ name: 'main.tf', text: 'resource {' }])).toMatchObject({
      ok: false,
      error: { code: 'parse', file: 'main.tf' },
    });
    expect(infraGraph([{ name: 'k8s.yaml', text: 'apiVersion: v1\nkind: [' }])).toMatchObject({
      ok: false,
      error: { code: 'parse', file: 'k8s.yaml' },
    });
    expect(infraGraph([{ name: 'main.tf', text: 'variable "x" {}' }])).toMatchObject({
      ok: false,
      error: { code: 'nothing-to-draw', file: 'main.tf' },
    });
    expect(infraGraph([{ text: 'services: {}' }])).toMatchObject({
      ok: false,
      error: { code: 'no-services' },
    });
    expect(infraGraph([{ name: 'wrangler.toml', text: 'name = "a"' }], { env: 'x' })).toMatchObject(
      {
        ok: false,
        error: { code: 'unknown-env', file: 'wrangler.toml' },
      },
    );
    expect(infraGraph([{ text: '' }]).ok).toBe(false);
  });

  it('refuses nothing to draw and too many files', () => {
    expect(infraGraph([])).toMatchObject({ ok: false, error: { code: 'nothing-to-draw' } });
    expect(infraGraph([{ text: 'compatibility_date = "2026-01-01"' }])).toMatchObject({
      ok: false,
      error: { code: 'nothing-to-draw' },
    });
    const files = Array.from({ length: INFRA_MAX_FILES + 1 }, () => ({ text: 'name = "a"' }));
    expect(infraGraph(files)).toMatchObject({ ok: false, error: { code: 'too-many-files' } });
  });

  it('groups by prefix and caps a 200-service file, and lays it out within budget', () => {
    const text = bigCompose(200);
    let laidOut = 0;
    const ms = cpuMsOf(() => {
      const result = ok(infraGraph([{ name: 'compose.yml', text }]));
      expect(result.graph.nodes).toHaveLength(INFRA_MAX_NODES);
      expect(result.graph.nodes.at(-1)).toMatchObject({ id: MORE_NODE_ID, label: '51 more' });
      expect(result.leftOut).toBe(51);
      expect(result.graph.groups?.length).toBe(12);
      laidOut = layoutGraph(result.graph).length;
    });
    expect(laidOut).toBeGreaterThan(INFRA_MAX_NODES);
    expect(ms).toBeLessThan(cpuBudgetMs(1000));
  });

  it('leaves a mid-sized system ungrouped and keeps network frames over prefixes', () => {
    expect(ok(infraGraph([{ text: bigCompose(INFRA_GROUP_FROM) }])).graph.groups).toBeUndefined();
    const framed = `${bigCompose(INFRA_GROUP_FROM + 1)}\n  zz-net-a: { networks: [n] }\n  zz-net-b: { networks: [n] }`;
    const groups = ok(infraGraph([{ text: framed }])).graph.groups;
    expect(groups?.map((g) => g.id)).toEqual(['net-n']);
  });

  it('caps the lines at the graph builder’s limit', () => {
    // 45 services, each depending on every earlier one: 990 lines, plus volumes, past 1,000.
    const lines = ['services:'];
    for (let i = 0; i < 46; i++) {
      lines.push(`  s${i}:`);
      if (i > 0)
        lines.push(`    depends_on: [${Array.from({ length: i }, (_, j) => `s${j}`).join(', ')}]`);
    }
    const result = ok(infraGraph([{ text: lines.join('\n') }]));
    expect(result.graph.edges).toHaveLength(1000);
    expect(result.linesLeftOut).toBe(35);
  });
});

describe('large-system helpers', () => {
  it('frames only prefixes two or more share', () => {
    expect(
      groupByPrefix([
        { id: 'a', label: 'billing-api' },
        { id: 'b', label: 'Billing_worker' },
        { id: 'c', label: 'search.api' },
        { id: 'd', label: '-lead' },
        { id: 'e' },
      ]),
    ).toEqual([{ id: 'grp-billing', label: 'billing', members: ['a', 'b'] }]);
  });

  it('lists at most two hundred names in the "more" box', () => {
    // An unlabelled node is listed by its id.
    const nodes = Array.from({ length: 405 }, (_, i) =>
      i === 10 ? { id: 'bare' } : { id: `n${i}`, label: `n${i}` },
    );
    const capped = capNodes(
      nodes,
      [{ from: 'n0', to: 'n300' }],
      [{ id: 'g', label: 'g', members: ['n300'] }],
      5,
    );
    expect(capped.nodes).toHaveLength(5);
    expect(capped.edges).toEqual([]);
    expect(capped.groups).toEqual([]);
    expect(capped.nodes[4]!.note!.split('\n')).toHaveLength(201);
    expect(capped.nodes[4]!.note).toMatch(/\nand 201 more$/);
    expect(capped.nodes[4]!.note!.split('\n')).toContain('bare');
  });

  it('slugs names to id parts', () => {
    expect(slug('Shop API_v2')).toBe('shop-api-v2');
    expect(slug('--')).toBe('x');
    expect(slug('日本')).toBe('x');
  });

  it('writes the summary line, counting repeats and the rest past twelve', () => {
    expect(skippedLine([])).toBe('');
    expect(
      skippedLine([
        { key: 'vars', count: 1 },
        { key: 'observability', count: 2 },
      ]),
    ).toBe('vars, observability (2)');
    const many = Array.from({ length: 14 }, (_, i) => ({ key: `k${i}`, count: 1 }));
    expect(skippedLine(many)).toMatch(/k11 and 2 more$/);
    expect(
      mergeSkipped([
        [{ key: 'a', count: 1 }],
        [
          { key: 'a', count: 2 },
          { key: 'b', count: 1 },
        ],
      ]),
    ).toEqual([
      { key: 'a', count: 3 },
      { key: 'b', count: 1 },
    ]);
  });
});
