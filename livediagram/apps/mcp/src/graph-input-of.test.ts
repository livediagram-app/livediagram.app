// docs/specs/015-api/mcp-server.md §4.7 "What a graph leaves out": an icon that names none is left off and said.
import { describe, expect, it } from 'vitest';
import { withKnownIcons } from './element-values';
import { graphInputOf } from './graph-input-of';

const node = (id: string, icon?: string) => ({ id, label: id, ...(icon ? { icon } : {}) });

describe('graphInputOf', () => {
  it('leaves an unknown icon off its node and says which, with the icons like it', () => {
    const input = graphInputOf({
      graph: {
        nodes: [node('send', 'envelope'), node('db', 'database'), node('plain')],
        edges: [{ from: 'send', to: 'db' }],
      },
    });
    expect(input.error).toBeUndefined();
    expect(input.graph!.nodes).toEqual([node('send'), node('db', 'database'), node('plain')]);
    expect(input.notes).toHaveLength(1);
    expect(input.notes![0]).toMatch(
      /^1 icon left off, naming no icon: send "envelope" \(like it: .*mail.*\)\. search_icons finds an id/,
    );
  });

  it('keeps the notes the graph already had, and adds none when every icon is one', () => {
    const noted = graphInputOf({
      graph: { nodes: [node('a', 'zzqx')], edges: [{ from: 'a', to: 'ghost' }] },
    });
    expect(noted.notes).toHaveLength(2);
    expect(noted.notes![1]).toMatch(/^1 icon left off, naming no icon: a "zzqx"\. /);
    const clean = graphInputOf({ graph: { nodes: [node('a', 'database')], edges: [] } });
    expect(clean.notes).toBeUndefined();
    expect(clean.graph!.nodes[0]!.icon).toBe('database');
  });

  it('hands back an input with no graph, and an error, as they came', () => {
    expect(graphInputOf({})).toEqual({});
    expect(graphInputOf({ mermaid: 'gantt\n title x' }).error).toMatch(
      /^Could not read the Mermaid/,
    );
  });
});

describe('withKnownIcons', () => {
  it('names five and counts the rest', () => {
    const nodes = Array.from({ length: 7 }, (_, i) => node(`n${i}`, `zzqx${i}`));
    const { note, nodes: kept } = withKnownIcons(nodes);
    expect(kept.every((n) => n.icon === undefined)).toBe(true);
    expect(note).toMatch(
      /^7 icons left off, naming no icon: n0 "zzqx0"; .*n4 "zzqx4" and 2 more\. /,
    );
  });
});
