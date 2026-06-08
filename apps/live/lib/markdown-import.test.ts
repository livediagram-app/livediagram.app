import { describe, expect, it } from 'vitest';
import {
  buildTabFromMarkdown,
  cleanInline,
  layoutOutline,
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
