import { describe, expect, it } from 'vitest';
import { layoutGraph } from '../graph-input';
import { infraFileFacts } from './facts';
import { INFRA_SOURCES_MAX_STORED_CHARS } from './limits';
import { drawnRecord, edgeKeyOf, fingerprint, keyedElements, sourceFiles } from './sources';
import { infraGraph } from './graph';

describe('infraFileFacts', () => {
  it('reads a file’s format and its Wrangler environments', () => {
    expect(
      infraFileFacts({
        name: 'wrangler.toml',
        text: 'name = "a"\n[env]\nbad = 1\n[env.staging]\nname = "b"',
      }),
    ).toEqual({ format: 'wrangler', envs: ['staging'] });
    expect(infraFileFacts({ name: 'wrangler.toml', text: 'name = ' })).toEqual({
      format: 'wrangler',
      envs: [],
    });
    expect(infraFileFacts({ name: 'wrangler.toml', text: 'name = "a"' }).envs).toEqual([]);
    expect(infraFileFacts({ name: 'main.tf', text: 'x' })).toEqual({
      format: 'terraform',
      envs: [],
    });
  });
});

describe('the sources record', () => {
  it('fingerprints text with FNV-1a', () => {
    expect(fingerprint('')).toBe('811c9dc5');
    expect(fingerprint('a')).toBe('e40c292c');
    expect(fingerprint('name = "api"')).not.toBe(fingerprint('name = "apj"'));
  });

  it('keeps texts in order while they fit, then names and fingerprints only', () => {
    const big = 'x'.repeat(INFRA_SOURCES_MAX_STORED_CHARS - 10);
    const files = sourceFiles([
      { name: 'a.toml', text: big },
      { name: 'b/compose.yml', text: 'services:\n  a: {}' },
      { text: 'n = 1' },
    ]);
    expect(files.map((f) => [f.name, f.format, f.text?.length])).toEqual([
      ['a.toml', 'wrangler', big.length],
      ['b/compose.yml', 'compose', undefined],
      ['wrangler.toml', 'wrangler', 5],
    ]);
    expect(files[1]!.hash).toBe(fingerprint('services:\n  a: {}'));
  });

  it('records what each node, group, heading and line became', () => {
    const result = infraGraph([
      {
        name: 'compose.yml',
        text: 'services:\n  web:\n    image: nginx\n    depends_on: [db]\n    networks: [front]\n  db:\n    networks: [front]',
      },
    ]);
    if (!result.ok) throw new Error(result.error.message);
    const elements = layoutGraph(result.graph);
    const record = drawnRecord(elements, result.graph);
    expect(Object.keys(record.nodes).sort()).toEqual(
      ['#caption', '#title', 'net-front', 'svc-db', 'svc-web'].sort(),
    );
    expect(record.nodes['svc-web']).toMatchObject({
      el: 'svc-web',
      label: 'web',
      iconId: 'nginx',
      note: 'image: nginx',
    });
    expect(record.nodes['#title']!.label).toBe('Compose');
    expect(Object.keys(record.edges)).toEqual(['svc-web>svc-db']);
    const arrow = elements.find((e) => e.id === record.edges['svc-web>svc-db']);
    expect(arrow?.type).toBe('arrow');
  });

  it('keys an arrow only when both its ends are pinned to keyed elements', () => {
    const keyOf = (id: string) => (id === 'a' || id === 'b' ? id : undefined);
    const pinned = (id: string) => ({
      kind: 'pinned' as const,
      elementId: id,
      anchor: 'n' as const,
    });
    const arrow = { id: 'x', type: 'arrow' as const, from: pinned('a'), to: pinned('b') };
    expect(edgeKeyOf(arrow, keyOf)).toBe('a>b');
    expect(edgeKeyOf({ ...arrow, to: pinned('c') }, keyOf)).toBeUndefined();
    expect(edgeKeyOf({ ...arrow, to: { kind: 'free', x: 0, y: 0 } }, keyOf)).toBeUndefined();
    expect(edgeKeyOf({ id: 'r', type: 'text', x: 0, y: 0, width: 1, height: 1 }, keyOf)).toBe(
      undefined,
    );
  });

  it('keys a heading only once, and only when the graph has one', () => {
    const els = [
      { id: 't1', type: 'text' as const, x: 0, y: 0, width: 9, height: 9, label: 'T' },
      { id: 't2', type: 'text' as const, x: 0, y: 0, width: 9, height: 9, label: 'T' },
      { id: 'c1', type: 'text' as const, x: 0, y: 0, width: 9, height: 9, label: 'S' },
      { id: 'c2', type: 'text' as const, x: 0, y: 0, width: 9, height: 9, label: 'S' },
    ];
    const keyed = keyedElements(els, { title: 'T', subtitle: 'S', nodes: [], edges: [] });
    expect(keyed.get('#title')!.id).toBe('t1');
    expect(keyed.get('#caption')!.id).toBe('c1');
    expect(keyedElements(els, { nodes: [], edges: [] }).size).toBe(0);
  });
});
