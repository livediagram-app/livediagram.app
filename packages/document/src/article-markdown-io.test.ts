import { describe, expect, it } from 'vitest';
import type { ArticleBlock, ArticleFlow } from './article-flow';
import {
  ARTICLE_MARKDOWN_MAX,
  articleFromMarkdown,
  articleTitleOf,
  articleToMarkdown,
  articleWordCount,
} from './article-markdown-io';
import { parseInline } from './article-markdown';

// docs/specs/024-agents/illustrate-for-agents.md "write_article", "Reading: the pages view".

const blocksOf = (text: string, current?: ArticleFlow): ArticleBlock[] => {
  const out = articleFromMarkdown(text, current);
  if ('unknownZone' in out) throw new Error(out.unknownZone);
  return out.blocks;
};
// Blocks without their ids, to compare shapes.
const shape = (blocks: readonly ArticleBlock[]) =>
  blocks.map(({ id: _id, ...b }) => {
    void _id;
    return b;
  });

const zone = (id: string): ArticleBlock => ({
  id,
  type: 'zone',
  zone: 'object',
  width: 200,
  height: 120,
});

describe('Markdown into an article', () => {
  it('reads front matter as the title and subtitle, first', () => {
    const blocks = blocksOf(
      '---\ntitle: "Quarterly report"\nsubtitle: Q3, at a glance\nauthor: x\n---\n# Summary\nAll good.',
    );
    expect(shape(blocks)).toEqual([
      { type: 'paragraph', style: 'title', runs: [{ text: 'Quarterly report' }] },
      { type: 'paragraph', style: 'subtitle', runs: [{ text: 'Q3, at a glance' }] },
      { type: 'paragraph', style: 'h1', runs: [{ text: 'Summary' }] },
      { type: 'paragraph', runs: [{ text: 'All good.' }] },
    ]);
  });

  it('writes no title without front matter, and ignores empty fields', () => {
    expect(shape(blocksOf('Just text.'))).toEqual([
      { type: 'paragraph', runs: [{ text: 'Just text.' }] },
    ]);
    expect(shape(blocksOf('---\ntitle:\n---\nBody'))).toEqual([
      { type: 'paragraph', runs: [{ text: 'Body' }] },
    ]);
  });

  it('reads \\pagebreak lines as page breaks, never inside a code fence', () => {
    const blocks = blocksOf('One\n\n\\pagebreak\n\nTwo\n\n```\n\\pagebreak\n```');
    expect(shape(blocks)).toEqual([
      { type: 'paragraph', runs: [{ text: 'One' }] },
      { type: 'pageBreak' },
      { type: 'paragraph', runs: [{ text: 'Two' }] },
      { type: 'code', text: '\\pagebreak' },
    ]);
  });

  it('keeps a zone where its line is, drops the zones left out, refuses an unknown one', () => {
    const current: ArticleFlow = { blocks: [zone('z-1'), zone('z-2')] };
    const out = articleFromMarkdown('Before\n\n[zone z-2]\n\nAfter\n\n[zone z-2]', current);
    if ('unknownZone' in out) throw new Error('unexpected');
    expect(out.blocks.map((b) => b.type)).toEqual(['paragraph', 'zone', 'paragraph']);
    expect(out.blocks[1]).toBe(current.blocks[1]);
    expect(out.keptZones).toEqual(['z-2']);
    expect(out.droppedZones).toEqual(['z-1']);
    expect(articleFromMarkdown('[zone z-9]', current)).toEqual({ unknownZone: 'z-9' });
    expect(articleFromMarkdown('```\n[zone z-9]\n```', current)).toMatchObject({ keptZones: [] });
  });

  it('gives every block a fresh, distinct id', () => {
    const blocks = blocksOf('---\ntitle: T\n---\nA\n\n\\pagebreak\n\nB\n\n- c\n- d');
    expect(new Set(blocks.map((b) => b.id)).size).toBe(blocks.length);
  });
});

describe('Markdown escapes', () => {
  it('reads an escaped mark as its character', () => {
    expect(parseInline('2 \\* 3 = 6 and \\_x\\_ and \\[y\\]')).toEqual([
      { text: '2 * 3 = 6 and _x_ and [y]' },
    ]);
    expect(parseInline('**bold \\*star\\***')).toEqual([{ text: 'bold *star*', b: true }]);
    expect(parseInline('[a\\]b](https://x.dev/\\(1\\))')).toEqual([
      { text: 'a]b', href: 'https://x.dev/(1)' },
    ]);
  });
});

describe('an article as Markdown', () => {
  const flow: ArticleFlow = {
    blocks: [
      { id: '1', type: 'paragraph', style: 'title', runs: [{ text: 'Brief' }] },
      { id: '2', type: 'paragraph', style: 'subtitle', runs: [{ text: 'Why and how' }] },
      { id: '3', type: 'paragraph', style: 'h1', runs: [{ text: 'Goals' }] },
      {
        id: '4',
        type: 'paragraph',
        runs: [
          { text: 'Ship ' },
          { text: 'fast', b: true },
          { text: ', ' },
          { text: 'calmly', i: true },
          { text: ' and ' },
          { text: 'docs', href: 'https://x.dev' },
          { text: ' with ' },
          { text: 'a*b', code: true },
        ],
      },
      { id: '5', type: 'list', list: 'bullet', runs: [{ text: 'One' }] },
      { id: '6', type: 'list', list: 'bullet', level: 1, runs: [{ text: 'Nested' }] },
      { id: '7', type: 'list', list: 'numbered', runs: [{ text: 'First' }] },
      { id: '8', type: 'list', list: 'numbered', runs: [{ text: 'Second' }] },
      { id: '9', type: 'list', list: 'todo', checked: true, runs: [{ text: 'Done' }] },
      { id: '10', type: 'list', list: 'todo', runs: [{ text: 'Open' }] },
      { id: '11', type: 'paragraph', style: 'quote', runs: [{ text: 'A plan is a guess.' }] },
      { id: '12', type: 'code', text: 'const a = 1;' },
      { id: '13', type: 'divider' },
      { id: '14', type: 'pageBreak' },
      zone('z-1'),
      { id: '15', type: 'paragraph', style: 'h2', runs: [{ text: 'Sub' }] },
      { id: '16', type: 'paragraph', style: 'h3', runs: [{ text: 'Subsub' }] },
      {
        id: '17',
        type: 'paragraph',
        runs: [{ text: '# not a heading, - not a list, 1. not numbered' }],
      },
      { id: '18', type: 'list', list: 'bullet', runs: [{ text: '- dash first', s: true }] },
    ],
  };

  it('prints front matter, blocks and zones in the form write_article takes', () => {
    const md = articleToMarkdown(flow);
    expect(md.startsWith('---\ntitle: Brief\nsubtitle: Why and how\n---\n\n# Goals\n')).toBe(true);
    expect(md).toContain('Ship **fast**, *calmly* and [docs](https://x.dev) with `a*b`');
    expect(md).toContain(
      '- One\n  - Nested\n1. First\n2. Second\n- [x] Done\n- [ ] Open\n\n> A plan',
    );
    expect(md).toContain(
      '```\nconst a = 1;\n```\n\n---\n\n\\pagebreak\n\n[zone z-1]\n\n## Sub\n\n### Subsub',
    );
    expect(md).toContain('\\# not a heading');
    expect(md.endsWith('\n')).toBe(true);
  });

  it('reads back block for block', () => {
    const back = blocksOf(articleToMarkdown(flow), flow);
    expect(shape(back)).toEqual(shape(flow.blocks));
  });

  it('prints an empty article as nothing, and a line break as a space', () => {
    expect(articleToMarkdown({ blocks: [] })).toBe('');
    expect(
      articleToMarkdown({ blocks: [{ id: 'a', type: 'paragraph', runs: [{ text: 'a\nb' }] }] }),
    ).toBe('a b\n');
  });

  it('counts words and names the article by its title, else its first heading', () => {
    expect(articleWordCount(flow)).toBeGreaterThan(20);
    expect(articleTitleOf(flow)).toBe('Brief');
    expect(articleTitleOf({ blocks: [flow.blocks[2]!] })).toBe('Goals');
    expect(articleTitleOf({ blocks: [] })).toBe('Untitled');
  });
});

describe('worst case', () => {
  it(`reads ${ARTICLE_MARKDOWN_MAX.toLocaleString('en')} characters of Markdown in budget`, () => {
    const para =
      'Some **bold** words, *some italic* and a [link](https://x.dev), then `code` and more text. ';
    const lines: string[] = [];
    let size = 0;
    for (let i = 0; size < ARTICLE_MARKDOWN_MAX; i++) {
      const line = i % 10 === 0 ? `## Heading ${i}` : i % 3 === 0 ? `- ${para}` : para;
      lines.push(line, '');
      size += line.length + 2;
    }
    const text = lines.join('\n').slice(0, ARTICLE_MARKDOWN_MAX);
    const started = performance.now();
    const blocks = blocksOf(text);
    const took = performance.now() - started;
    expect(blocks.length).toBeGreaterThan(1000);
    // Budget 100 ms; held at 1,000 ms for CI under load.
    expect(took).toBeLessThan(1000);
  });
});
