// Lines a Mermaid flowchart import could not read are said, not lost (docs/specs/020-import-export/mermaid.md
// "Unreadable lines are said, not lost"): counted and quoted, and a flowchart with nothing readable is refused.
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { graphFromMermaid } from './graph-input';
import { parseMermaid, unreadMermaidLines } from './mermaid';

describe('unread flowchart lines', () => {
  it('refuses a flowchart whose only content is unreadable, rather than drawing a lone box', () => {
    // The card's paste: a bracket never closed, then a line with no node id.
    const parsed = parseMermaid('flowchart TD\nA[Start -->\n((( broken');
    expect(parsed).toEqual({
      ok: false,
      error:
        'None of this flowchart could be read. Check the brackets and arrows on “A[Start -->”.',
    });
  });

  it('imports what it read and returns the lines it skipped, in order', () => {
    const parsed = parseMermaid(
      'flowchart TD\nA --> B\nB[Open bracket --> C\n((( broken\nC --> D[Done]',
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.unread).toEqual(['B[Open bracket --> C', '((( broken']);
    expect(parsed.graph.edges.map((e) => `${e.from}>${e.to}`)).toEqual(['A>B', 'C>D']);
  });

  it('counts an edge with no target as unread', () => {
    const parsed = parseMermaid('graph LR\nA --> B\nB -->');
    expect(parsed.ok && parsed.unread).toEqual(['B -->']);
  });

  it('keeps known decoration silent', () => {
    const parsed = parseMermaid(
      [
        '%%{init: {"theme": "dark"}}%%',
        'flowchart LR',
        '  %% a comment',
        '  classDef hot fill:#f96',
        '  class A hot',
        '  style B fill:#bbf',
        '  linkStyle 0 stroke:#f00',
        '  direction TB',
        '  accTitle: Checkout',
        '  accDescr: How an order is paid',
        '  A[Cart]:::hot -->|pay| B(Pay) ~~~ C',
        '  A e1@--> C',
        '  e1@{ animate: true }',
        '  click A "https://example.com"',
        '  click B callback',
        '  subgraph S [Shop]',
        '    C@{ shape: cyl, label: "Store" }',
        '  end',
      ].join('\n'),
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.unread).toBeUndefined();
  });

  it('quotes the first five lines, cut short, then how many more', () => {
    expect(unreadMermaidLines(['A[x'])).toBe('Line Mermaid could not read, skipped: “A[x”');
    const long = `A[${'x'.repeat(60)}`;
    const many = [long, 'b', 'c', 'd', 'e', 'f', 'g'];
    expect(unreadMermaidLines(many)).toBe(
      `Lines Mermaid could not read, skipped: “A[${'x'.repeat(37)}…”, “b”, “c”, “d”, “e” and 2 more`,
    );
  });

  it('says the skipped lines and the folds back through the graph input', () => {
    const parsed = graphFromMermaid(
      'flowchart TD\nsubgraph A\nsubgraph B\nX --> Y\nend\nend\nY --> Z[unclosed',
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.folded).toBe(1);
    expect(parsed.unread).toEqual(['Y --> Z[unclosed']);
    expect(parsed.notes).toEqual([
      '1 nested subgraph folded into their outer group: groups draw one level deep',
      'Line Mermaid could not read, skipped: “Y --> Z[unclosed”',
    ]);
  });

  it('stays linear on a long unreadable paste', () => {
    const lines = ['flowchart TD', 'A --> B'];
    for (let i = 0; i < 2_000; i += 1) lines.push(`[${i} ${'('.repeat(20)} -->`);
    lines.push('('.repeat(50_000), `A[${' '.repeat(50_000)}`, `A ${'-'.repeat(50_000)}`);
    const text = lines.join('\n');
    let parsed: ReturnType<typeof parseMermaid> | undefined;
    const ms = cpuMsOf(() => {
      parsed = parseMermaid(text);
    });
    expect(parsed?.ok && parsed.unread?.length).toBe(2_003);
    expect(ms).toBeLessThan(cpuBudgetMs(500));
  });
});
