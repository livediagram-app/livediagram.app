import { cpuMsOf } from '@livediagram/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import {
  isValidTab,
  MAX_TABLE_CELLS,
  MAX_TABLE_COLS,
  MAX_TABLE_ROWS,
  type TableElement,
} from '@livediagram/document';
import {
  buildTabFromMarkdown,
  cleanInline,
  layoutOutline,
  MARKDOWN_LEFT_OUT_RULE,
  markdownImportOutcome,
  MAX_LIST_DEPTH,
  MAX_MARKDOWN_IMPORT_NODES,
  parseMarkdown,
  type MarkdownNode,
} from './markdown-import';

// Flatten a parsed forest into "depth:label" strings for compact assertions.
function flatten(nodes: MarkdownNode[], depth = 0): string[] {
  return nodes.flatMap((n) => [`${depth}:${n.label}`, ...flatten(n.children, depth + 1)]);
}

describe('cleanInline', () => {
  it('strips bold, italic, code, strikethrough, and links to plain text', () => {
    expect(cleanInline('**bold** and *italic*')).toBe('bold and italic');
    expect(cleanInline('a `code` span')).toBe('a code span');
    expect(cleanInline('~~gone~~ kept')).toBe('gone kept');
    expect(cleanInline('see [the docs](https://x.y/z)')).toBe('see the docs');
    expect(cleanInline('![alt text](img.png)')).toBe('alt text');
    expect(cleanInline('<b>html</b> tags')).toBe('html tags');
    expect(cleanInline('  collapse   spaces  ')).toBe('collapse spaces');
  });
});

describe('parseMarkdown — headings', () => {
  it('nests headings by their # depth', () => {
    const { roots } = parseMarkdown(['# Root', '## A', '### A1', '## B'].join('\n'));
    expect(flatten(roots)).toEqual(['0:Root', '1:A', '2:A1', '1:B']);
  });

  it('drops optional closing hashes', () => {
    const { roots } = parseMarkdown('# Title #\n');
    expect(roots[0]!.label).toBe('Title');
  });
});

describe('parseMarkdown — lists', () => {
  it('nests list items by indentation under the current heading', () => {
    const md = ['# Topic', '- A', '  - A1', '  - A2', '- B'].join('\n');
    expect(flatten(parseMarkdown(md).roots)).toEqual(['0:Topic', '1:A', '2:A1', '2:A2', '1:B']);
  });

  it('handles ordered lists and strips task-list checkboxes', () => {
    const md = ['1. First', '2. Second', '- [ ] todo', '- [x] done'].join('\n');
    expect(flatten(parseMarkdown(md).roots)).toEqual(['0:First', '0:Second', '0:todo', '0:done']);
  });

  it('treats a tab as one indentation level', () => {
    const md = ['- A', '\t- A1'].join('\n');
    expect(flatten(parseMarkdown(md).roots)).toEqual(['0:A', '1:A1']);
  });
});

describe('parseMarkdown — robustness', () => {
  it('skips fenced code blocks entirely', () => {
    const md = ['# Real', '```js', '# not a heading', '- not a list', '```', '- Actual'].join('\n');
    expect(flatten(parseMarkdown(md).roots)).toEqual(['0:Real', '1:Actual']);
  });

  it('ignores horizontal rules', () => {
    const md = ['# A', '---', '# B'].join('\n');
    expect(flatten(parseMarkdown(md).roots)).toEqual(['0:A', '0:B']);
  });

  it('attaches prose lines as leaves under the current heading', () => {
    const md = ['# Heading', 'Some prose here.'].join('\n');
    expect(flatten(parseMarkdown(md).roots)).toEqual(['0:Heading', '1:Some prose here.']);
  });

  it('returns an empty forest for content-free input', () => {
    expect(parseMarkdown('\n\n   \n').roots).toEqual([]);
  });
});

describe('parseMarkdown — tables', () => {
  it('parses a GFM table into headers + rows', () => {
    const md = ['| Name | Role |', '| --- | :---: |', '| Sam | Dev |', '| Lee | PM |'].join('\n');
    const { tables, roots } = parseMarkdown(md);
    expect(roots).toEqual([]);
    expect(tables).toHaveLength(1);
    expect(tables[0]!.headers).toEqual(['Name', 'Role']);
    expect(tables[0]!.rows).toEqual([
      ['Sam', 'Dev'],
      ['Lee', 'PM'],
    ]);
  });
});

describe('layoutOutline', () => {
  it('places one box per node and one connector per parent→child edge', () => {
    const root: MarkdownNode = {
      label: 'R',
      children: [
        { label: 'A', children: [{ label: 'A1', children: [] }] },
        { label: 'B', children: [] },
      ],
    };
    const { elements } = layoutOutline(root);
    const boxes = elements.filter((e) => e.type !== 'arrow');
    const arrows = elements.filter((e) => e.type === 'arrow');
    expect(boxes).toHaveLength(4); // R, A, A1, B
    expect(arrows).toHaveLength(3); // R→A, R→B, A→A1
    // No NaN positions.
    expect(
      elements.every((e) => e.type === 'arrow' || (Number.isFinite(e.x) && Number.isFinite(e.y))),
    ).toBe(true);
  });

  it('centres a parent vertically on the span of its children', () => {
    const root: MarkdownNode = {
      label: 'R',
      children: [
        { label: 'A', children: [] },
        { label: 'B', children: [] },
      ],
    };
    const { elements } = layoutOutline(root);
    const byLabel = (l: string) =>
      elements.find((e) => e.type !== 'arrow' && 'label' in e && e.label === l)!;
    const r = byLabel('R') as { y: number; height: number };
    const a = byLabel('A') as { y: number; height: number };
    const b = byLabel('B') as { y: number; height: number };
    const cy = (el: { y: number; height: number }) => el.y + el.height / 2;
    expect(cy(r)).toBeCloseTo((cy(a) + cy(b)) / 2, 5);
  });

  it('puts deeper nodes in further-right columns', () => {
    const root: MarkdownNode = { label: 'R', children: [{ label: 'A', children: [] }] };
    const { elements } = layoutOutline(root);
    const r = elements.find((e) => e.type !== 'arrow' && 'label' in e && e.label === 'R') as {
      x: number;
    };
    const a = elements.find((e) => e.type !== 'arrow' && 'label' in e && e.label === 'A') as {
      x: number;
    };
    expect(a.x).toBeGreaterThan(r.x);
  });
});

describe('buildTabFromMarkdown', () => {
  it('uses a single top-level node as the diagram root', () => {
    const md = ['# Plan', '- One', '- Two'].join('\n');
    const result = buildTabFromMarkdown(md, { tabName: 'file' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const labels = result.tab.elements
      .filter((e) => e.type !== 'arrow')
      .map((e) => (e as { label?: string }).label);
    expect(labels).toContain('Plan');
    expect(labels).toContain('One');
    expect(labels).toContain('Two');
    // 3 nodes → 2 edges.
    expect(result.tab.elements.filter((e) => e.type === 'arrow')).toHaveLength(2);
  });

  it('wraps multiple top-level nodes under a synthetic root named for the file', () => {
    const md = ['# A', '# B'].join('\n');
    const result = buildTabFromMarkdown(md, { tabName: 'My Notes' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const labels = result.tab.elements
      .filter((e) => e.type !== 'arrow')
      .map((e) => (e as { label?: string }).label);
    expect(labels).toContain('My Notes'); // synthetic root
    expect(result.tab.elements.filter((e) => e.type === 'arrow')).toHaveLength(2); // root→A, root→B
  });

  it('applies the requested theme to the new tab', () => {
    const result = buildTabFromMarkdown('# X', { themeId: 'forest' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tab.theme).toBe('forest');
    expect(result.tab.templateChosen).toBe(true);
  });

  it('imports a tables-only document as a table element', () => {
    const md = ['| a | b |', '|---|---|', '| 1 | 2 |'].join('\n');
    const result = buildTabFromMarkdown(md);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const tables = result.tab.elements.filter((e) => e.type === 'table');
    expect(tables).toHaveLength(1);
  });

  it('errors clearly when there is nothing to import', () => {
    const result = buildTabFromMarkdown('```\njust code\n```\n');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/no headings, lists, or tables/i);
  });
});

// Untrusted text stays linear: a long run of `[`, `![` or `<` once rescanned the line from each.
describe('cleanInline on hostile input', () => {
  it('costs about four times as much for four times the text, never sixteen', () => {
    const fastest = (text: string) =>
      Math.min(...[0, 1, 2].map(() => cpuMsOf(() => void cleanInline(text))));
    for (const run of ['[', '![', '<', '[a](']) {
      const small = fastest(run.repeat(5_000));
      const large = fastest(run.repeat(20_000));
      expect(large, run).toBeLessThan(small * 8 + 5);
    }
  });

  it('still strips links, images and tags', () => {
    expect(cleanInline('See [the docs](http://x) and ![logo](a.png) <b>now</b>')).toBe(
      'See the docs and logo now',
    );
  });
});

// Limits (docs/specs/020-import-export/markdown-import.md "Limits"): a table past what validation
// accepts is truncated to fit, and a list nests no deeper than MAX_LIST_DEPTH. 12,000 ever-deeper
// list lines used to recurse the layout past the stack.
describe('markdown import limits', () => {
  const depthOf = (node: MarkdownNode): number =>
    1 + Math.max(0, ...node.children.map((c) => depthOf(c)));

  it('nests a deep list no deeper than MAX_LIST_DEPTH, keeping every item', () => {
    const md = Array.from({ length: 12_000 }, (_, i) => `${'  '.repeat(i)}- item ${i}`).join('\n');
    const parsed = parseMarkdown(md);
    expect(depthOf(parsed.roots[0]!)).toBe(MAX_LIST_DEPTH);
    const result = buildTabFromMarkdown(md);
    expect(result.ok).toBe(true);
  });

  it('truncates a table to the rows validation accepts, and the tab stays valid', () => {
    const rows = Array.from({ length: 3_000 }, (_, i) => `| r${i} | v${i} |`);
    const md = ['| a | b |', '| - | - |', ...rows].join('\n');
    const result = buildTabFromMarkdown(md);
    if (!result.ok) throw new Error(result.error);
    const table = result.tab.elements.find((el) => el.type === 'table') as TableElement;
    expect(table.cells).toHaveLength(MAX_TABLE_ROWS);
    expect(table.cells[1]).toEqual(['r0', 'v0']);
    expect(isValidTab(result.tab)).toBe(true);
  });

  it('truncates a wide table to the cell budget', () => {
    const header = `|${Array.from({ length: 1_200 }, (_, i) => ` h${i} `).join('|')}|`;
    const delim = `|${Array.from({ length: 1_200 }, () => ' - ').join('|')}|`;
    const body = Array.from({ length: 80 }, () => header);
    const result = buildTabFromMarkdown([header, delim, ...body].join('\n'));
    if (!result.ok) throw new Error(result.error);
    const table = result.tab.elements.find((el) => el.type === 'table') as TableElement;
    expect(table.cells[0]).toHaveLength(MAX_TABLE_COLS);
    expect(table.cells.length * MAX_TABLE_COLS).toBeLessThanOrEqual(MAX_TABLE_CELLS);
    expect(isValidTab(result.tab)).toBe(true);
  });
});

// The node cap (docs/specs/020-import-export/markdown-import.md "Limits"): an import keeps the first
// MAX_MARKDOWN_IMPORT_NODES headings, list items, lines and tables, and the report counts the rest.
describe('markdown import node cap', () => {
  const countNodes = (nodes: MarkdownNode[]): number =>
    nodes.reduce((n, node) => n + 1 + countNodes(node.children), 0);
  const listOf = (n: number) =>
    ['# Root', ...Array.from({ length: n - 1 }, (_, i) => `- item ${i}`)].join('\n');

  it('keeps every node of a file at the cap, and leaves nothing out', () => {
    const result = buildTabFromMarkdown(listOf(MAX_MARKDOWN_IMPORT_NODES));
    if (!result.ok) throw new Error(result.error);
    expect(result.leftOut).toBe(0);
    expect(markdownImportOutcome(result.tab, result.leftOut)).toEqual({ status: 'done' });
  });

  it('keeps the first nodes in document order and counts the rest, tables included', () => {
    const md = [listOf(MAX_MARKDOWN_IMPORT_NODES + 10), '| a |', '| - |', '| 1 |', 'prose'].join(
      '\n',
    );
    const parsed = parseMarkdown(md);
    expect(countNodes(parsed.roots)).toBe(MAX_MARKDOWN_IMPORT_NODES);
    expect(parsed.tables).toHaveLength(0);
    expect(parsed.leftOut).toBe(12);
    const kept = parsed.roots[0]!.children;
    expect(kept[kept.length - 1]!.label).toBe(`item ${MAX_MARKDOWN_IMPORT_NODES - 2}`);
  });

  it('reports what was left out, with what landed, and the tab stays valid', () => {
    const result = buildTabFromMarkdown(listOf(MAX_MARKDOWN_IMPORT_NODES + 500));
    if (!result.ok) throw new Error(result.error);
    expect(result.leftOut).toBe(500);
    expect(isValidTab(result.tab)).toBe(true);
    expect(markdownImportOutcome(result.tab, result.leftOut)).toEqual({
      status: 'done',
      scene: {
        landed: { shape: MAX_MARKDOWN_IMPORT_NODES, connector: MAX_MARKDOWN_IMPORT_NODES - 1 },
        degraded: [],
        skipped: [{ rule: MARKDOWN_LEFT_OUT_RULE, count: 500 }],
      },
    });
    expect(MARKDOWN_LEFT_OUT_RULE).toBe(
      'Headings, list items, lines and tables beyond the first 2,000 were left out',
    );
  });

  // Worst case: a file far past the cap. The cap bounds what is built (above); reading the rest stays
  // linear, so four times the file costs about four times as much, never sixteen (measured
  // 2026-10-10: 2,000 nodes 7.5 ms, 40,000 nodes 38 ms with the cap, 157 ms without it). A growth
  // ratio on CPU time, as cleanInline's test above, so a busy machine cannot fail it.
  it('reads four times the file past the cap for about four times the cost, never sixteen', () => {
    const fastest = (md: string) =>
      Math.min(...[0, 1, 2].map(() => cpuMsOf(() => void buildTabFromMarkdown(md))));
    const smallMd = listOf(MAX_MARKDOWN_IMPORT_NODES * 10);
    const largeMd = listOf(MAX_MARKDOWN_IMPORT_NODES * 40);
    fastest(smallMd); // warm the JIT so the first sample is not the slow one
    const small = fastest(smallMd);
    const large = fastest(largeMd);
    expect(large).toBeLessThan(small * 8 + 5);
  });
});
