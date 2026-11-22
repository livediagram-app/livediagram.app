import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { ArticleBlock, ArticleFlow } from './article-flow';
import { articleFromMarkdown } from './article-markdown-io';
import { articleLeftOutNote, articleTabMarkdown } from './article-markdown-export';
import type { Tab } from './index';

// docs/specs/020-import-export/markdown-import.md "Markdown export".

const runs = (text: string) => [{ text }];
const sample: ArticleBlock[] = [
  { id: 'a', type: 'paragraph', style: 'title', runs: runs('Quarterly report') },
  { id: 'b', type: 'paragraph', style: 'subtitle', runs: runs('Q3, at a glance') },
  { id: 'c', type: 'paragraph', style: 'h1', runs: runs('Summary') },
  {
    id: 'd',
    type: 'paragraph',
    runs: [{ text: 'All ' }, { text: 'good', b: true }, { text: '.' }],
  },
  { id: 'e', type: 'list', list: 'bullet', runs: runs('One') },
  { id: 'f', type: 'list', list: 'numbered', level: 1, runs: runs('Two') },
  { id: 'g', type: 'list', list: 'todo', checked: true, runs: runs('Done') },
  { id: 'h', type: 'paragraph', style: 'quote', runs: runs('Said') },
  { id: 'i', type: 'code', text: 'const a = 1;' },
  { id: 'j', type: 'paragraph', runs: [{ text: 'Note ' }, { text: '*', fn: 'A footnote' }] },
  { id: 'k', type: 'divider' },
  { id: 'l', type: 'paragraph', runs: runs('After') },
] as ArticleBlock[];

const tabOf = (articles: Record<string, ArticleFlow>, elements: unknown[] = []) =>
  ({
    id: 't',
    name: 'T',
    elements,
    pages: Object.keys(articles).map((flow, i) => ({
      id: `p${i}`,
      orientation: 'portrait',
      kind: 'article',
      flow,
    })),
    articles,
  }) as unknown as Tab;

const shape = (blocks: readonly ArticleBlock[]) =>
  blocks.map(({ id: _id, ...b }) => {
    void _id;
    return b;
  });
const readBack = (markdown: string) => {
  const out = articleFromMarkdown(markdown);
  if (!('blocks' in out)) throw new Error(JSON.stringify(out));
  return out.blocks;
};

describe('articleTabMarkdown', () => {
  it('reads back, through the Markdown import, as the same blocks', () => {
    const { markdown, articles } = articleTabMarkdown(tabOf({ f: { blocks: sample } }));
    expect(articles).toBe(1);
    expect(shape(readBack(markdown))).toEqual(shape(sample));
  });

  it('leaves out a zone, which the import would refuse, and counts it', () => {
    const zone = { id: 'z', type: 'zone', zone: 'object', width: 10, height: 10 } as ArticleBlock;
    const out = articleTabMarkdown(tabOf({ f: { blocks: [sample[3]!, zone] } }));
    expect(out.leftOut.zones).toBe(1);
    expect(out.markdown).not.toContain('zone');
    expect(shape(readBack(out.markdown))).toEqual(shape([sample[3]!]));
  });

  it('counts a spot holding a picture once, as the picture', () => {
    const zone = { id: 'z', type: 'zone', zone: 'object', width: 10, height: 10 } as ArticleBlock;
    const out = articleTabMarkdown(
      tabOf({ f: { blocks: [sample[3]!, zone] } }, [{ id: 'i1', type: 'image' }]),
    );
    expect(out.leftOut).toEqual({ pictures: 1, other: 0, zones: 0 });
  });

  it('counts pictures and other items beside the writing', () => {
    const out = articleTabMarkdown(
      tabOf({ f: { blocks: [sample[3]!] } }, [
        { id: 'i1', type: 'image' },
        { id: 'i2', type: 'image' },
        { id: 's1', type: 'shape' },
      ]),
    );
    expect(out.leftOut).toEqual({ pictures: 2, other: 1, zones: 0 });
  });

  it('writes several articles in page order, the later ones headed rather than in front matter', () => {
    const second: ArticleFlow = { blocks: [sample[0]!, sample[3]!] };
    const out = articleTabMarkdown(tabOf({ f: { blocks: sample }, g: second }));
    expect(out.articles).toBe(2);
    expect(out.markdown.startsWith('---\ntitle: Quarterly report')).toBe(true);
    expect(out.markdown).toContain('\n\\pagebreak\n\n# Quarterly report\n');
    const blocks = shape(readBack(out.markdown));
    expect(blocks.some((b) => b.type === 'pageBreak')).toBe(true);
    expect(blocks.at(-2)).toMatchObject({ type: 'paragraph', style: 'h1' });
  });

  it('writes a tab with no article as nothing', () => {
    expect(articleTabMarkdown(tabOf({})).markdown).toBe('');
  });

  it('stays within a CPU budget on a long article', () => {
    const blocks = Array.from({ length: 2000 }, (_, i) => ({
      id: `b${i}`,
      type: 'paragraph',
      runs: runs(`Paragraph ${i} with some *words*`),
    })) as ArticleBlock[];
    const tab = tabOf({ f: { blocks } });
    expect(cpuMsOf(() => articleTabMarkdown(tab))).toBeLessThan(cpuBudgetMs(1000));
  });
});

describe('articleLeftOutNote', () => {
  it('says nothing when nothing is left out', () => {
    expect(articleLeftOutNote({ pictures: 0, other: 0, zones: 0 })).toBe('');
  });
  it('names each kind, singular and plural', () => {
    expect(articleLeftOutNote({ pictures: 1, other: 0, zones: 0 })).toBe(
      'Markdown holds text only, so 1 picture is left out. Export JSON to keep everything.',
    );
    expect(articleLeftOutNote({ pictures: 3, other: 1, zones: 2 })).toContain(
      '3 pictures, 1 other item and 2 drawing spots in the text are left out',
    );
    expect(articleLeftOutNote({ pictures: 0, other: 2, zones: 0 })).toContain('2 other items are');
  });
});
