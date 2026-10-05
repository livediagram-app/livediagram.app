import { describe, expect, it } from 'vitest';
import { classifySource } from './source-kind';

describe('classifySource', () => {
  it('reads whole-text JSON: a graph, a replace, one operation, operations, elements', () => {
    expect(classifySource('{"nodes":[{"id":"a"}],"edges":[]}')).toEqual({
      kind: 'graph',
      body: { replace: { graph: { nodes: [{ id: 'a' }], edges: [] } } },
    });
    expect(classifySource('{"replace":{"template":"kanban"}}')).toEqual({
      kind: 'replace',
      body: { replace: { template: 'kanban' } },
    });
    expect(classifySource('{"op":"rm","target":"n3"}')).toEqual({
      kind: 'operations',
      body: { operations: [{ op: 'rm', target: 'n3' }] },
    });
    expect(classifySource('[{"op":"rm","target":"n3"}]')).toEqual({
      kind: 'operations',
      body: { operations: [{ op: 'rm', target: 'n3' }] },
    });
    expect(classifySource('[{"id":"a","type":"text"}]')).toEqual({
      kind: 'elements',
      body: { replace: { elements: [{ id: 'a', type: 'text' }] } },
    });
    expect(classifySource('[]')).toMatchObject({ kind: 'elements' });
  });

  it('reads Mermaid by its header, and anything else as edit operations', () => {
    expect(classifySource('flowchart LR\n  a --> b\n')).toEqual({
      kind: 'mermaid',
      body: { replace: { mermaid: 'flowchart LR\n  a --> b\n' } },
    });
    const ops = 'add square id=web label=Web\nconnect web -> api\n';
    expect(classifySource(ops)).toEqual({ kind: 'operations', body: { operations: ops } });
    const jsonLines = '{"op":"rm","target":"a"}\n{"op":"rm","target":"b"}';
    expect(classifySource(jsonLines)).toEqual({
      kind: 'operations',
      body: { operations: jsonLines },
    });
  });

  it('cannot tell a JSON object of no known kind, a JSON primitive, or an empty file', () => {
    expect(classifySource('{"name":"x"}')).toEqual({ kind: 'unknown' });
    expect(classifySource('42')).toEqual({ kind: 'unknown' });
    expect(classifySource('  \n')).toEqual({ kind: 'unknown' });
  });
});
