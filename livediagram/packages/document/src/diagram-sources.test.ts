import { describe, expect, it } from 'vitest';
import { remapSourceIds, tabSourcesOf, type DiagramSources } from './diagram-sources';

const RECORD: DiagramSources = {
  bridge: 'infra',
  files: [{ name: 'compose.yml', format: 'compose', hash: 'abcd1234', text: 'services: {}' }],
  env: 'staging',
  readAt: 1_700_000_000_000,
  nodes: { 'svc-web': { el: 'svc-web', label: 'web', note: 'image: nginx', iconId: 'nginx' } },
  edges: { 'svc-web>svc-db': 'arrow-1' },
};

describe('tabSourcesOf', () => {
  it('reads a sound record as it is', () => {
    expect(tabSourcesOf({ sources: RECORD })).toEqual(RECORD);
  });

  it('reads no record, or one that does not read, as none', () => {
    expect(tabSourcesOf({})).toBeNull();
    expect(tabSourcesOf({ sources: 'x' })).toBeNull();
    expect(tabSourcesOf({ sources: { ...RECORD, bridge: 'mermaid' } })).toBeNull();
    expect(tabSourcesOf({ sources: { ...RECORD, files: {} } })).toBeNull();
    expect(tabSourcesOf({ sources: { ...RECORD, nodes: [] } })).toBeNull();
    expect(tabSourcesOf({ sources: { ...RECORD, edges: null } })).toBeNull();
    expect(
      tabSourcesOf({ sources: { ...RECORD, files: [{ name: 'a', format: 'x' }] } }),
    ).toBeNull();
    expect(tabSourcesOf({ sources: { ...RECORD, files: [1] } })).toBeNull();
  });

  it('drops the entries that do not read and settles the rest', () => {
    const read = tabSourcesOf({
      sources: {
        ...RECORD,
        env: 3,
        readAt: 'yesterday',
        files: [{ name: 'a', format: 'b', hash: 'c', text: 5 }],
        nodes: { ok: { el: 'e', label: 1, iconId: 'i' }, bad: { label: 'x' }, worse: 7 },
        edges: { 'a>b': 'x', 'c>d': 4 },
      },
    });
    expect(read).toEqual({
      bridge: 'infra',
      files: [{ name: 'a', format: 'b', hash: 'c' }],
      readAt: 0,
      nodes: { ok: { el: 'e', iconId: 'i' } },
      edges: { 'a>b': 'x' },
    });
  });
});

describe('remapSourceIds', () => {
  it('renames each element id it knows and keeps the rest', () => {
    const ids = new Map([['svc-web', 'copy-web']]);
    expect(remapSourceIds(RECORD, ids)).toEqual({
      ...RECORD,
      nodes: { 'svc-web': { ...RECORD.nodes['svc-web'], el: 'copy-web' } },
      edges: { 'svc-web>svc-db': 'arrow-1' },
    });
    expect(remapSourceIds(RECORD, new Map([['arrow-1', 'a2']])).edges).toEqual({
      'svc-web>svc-db': 'a2',
    });
  });
});
