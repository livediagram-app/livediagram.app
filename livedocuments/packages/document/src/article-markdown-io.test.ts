import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { MAX_ARTICLE_BLOCK_TEXT, type ArticleBlock, type ArticleFlow } from './article-flow';
import {
  ARTICLE_MARKDOWN_MAX,
  articleFromMarkdown,
  articleTitleOf,
  articleToMarkdown,
  articleWordCount,
} from './article-markdown-io';
import { parseInline, parseMarkdownBlocks } from './article-markdown';

// docs/specs/024-agents/pages-for-agents.md "write_article", "Reading: the pages view".

const blocksOf = (text: string, current?: ArticleFlow): ArticleBlock[] => {
  const out = articleFromMarkdown(text, current);
  if (!('blocks' in out)) throw new Error(JSON.stringify(out));
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
    if (!('blocks' in out)) throw new Error('unexpected');
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

describe('a line break in a paragraph', () => {
  const roundTrip = (block: ArticleBlock) =>
    shape(blocksOf(articleToMarkdown({ blocks: [block] })));

  it('is written as a backslash hard break and reads back as a break', () => {
    const block: ArticleBlock = {
      id: 'p',
      type: 'paragraph',
      runs: [
        { text: 'Jordan Blake\n' },
        { text: 'Harbour', b: true },
        { text: ' Coffee\n# Bristol\n\n1. BS8' },
      ],
    };
    expect(articleToMarkdown({ blocks: [block] })).toBe(
      'Jordan Blake\\\n**Harbour** Coffee\\\n\\# Bristol\\\n\\\n1\\. BS8\n',
    );
    expect(roundTrip(block)).toEqual([{ type: 'paragraph', runs: block.runs }]);
  });

  it('drops a break at the paragraph end, and keeps a heading on one line', () => {
    expect(
      articleToMarkdown({
        blocks: [
          { id: 'a', type: 'paragraph', runs: [{ text: 'end\n\n' }] },
          { id: 'b', type: 'paragraph', style: 'h2', runs: [{ text: 'a\nb' }] },
          { id: 'c', type: 'list', list: 'bullet', runs: [{ text: 'c\n' }] },
        ],
      }),
    ).toBe('end\n\n## a b\n\n- c\n');
  });
});

// Work Tracker #390: a quote and a list item keep their line breaks through a round trip.
describe('a line break in a quote or a list item', () => {
  const roundTrip = (blocks: ArticleBlock[]) => shape(blocksOf(articleToMarkdown({ blocks })));

  it('writes a quote line by line, each its own `> `, and reads it back as one quote', () => {
    const quote: ArticleBlock = {
      id: 'q',
      type: 'paragraph',
      style: 'quote',
      runs: [
        { text: 'Roses are red,\n' },
        { text: 'violets', i: true },
        { text: ' are blue\n\n- Anon' },
      ],
    };
    expect(articleToMarkdown({ blocks: [quote] })).toBe(
      '> Roses are red,\\\n> *violets* are blue\\\n> \\\n> \\- Anon\n',
    );
    expect(roundTrip([quote])).toEqual([{ type: 'paragraph', style: 'quote', runs: quote.runs }]);
  });

  it('writes a list item on lines indented under its text, at any level and marker', () => {
    const items: ArticleBlock[] = [
      { id: 'a', type: 'list', list: 'bullet', runs: [{ text: 'Harbour Coffee\n1 Quay St' }] },
      { id: 'b', type: 'list', list: 'numbered', level: 1, runs: [{ text: 'one\n# two' }] },
      { id: 'c', type: 'list', list: 'todo', checked: true, runs: [{ text: 'buy\nmilk' }] },
    ];
    expect(articleToMarkdown({ blocks: items })).toBe(
      '- Harbour Coffee\\\n  1 Quay St\n  1. one\\\n     \\# two\n- [x] buy\\\n      milk\n',
    );
    expect(roundTrip(items)).toEqual(shape(items));
  });

  it('reads CommonMark hard breaks written by others: two spaces, or a backslash', () => {
    expect(shape(blocksOf('> one  \n> two\n\n- three  \n  four\\\n  five\n'))).toEqual([
      { type: 'paragraph', style: 'quote', runs: [{ text: 'one\ntwo' }] },
      { type: 'list', list: 'bullet', runs: [{ text: 'three\nfour\nfive' }] },
    ]);
  });

  it('keeps `>` lines with no break apart, and never carries an item into a block of its own', () => {
    expect(shape(blocksOf('> a\n> b\\\n\n- c\\\n- d\\\n## e\n- f\\'))).toEqual([
      { type: 'paragraph', style: 'quote', runs: [{ text: 'a' }] },
      // A break with no `>` line after it is no break: the backslash stays.
      { type: 'paragraph', style: 'quote', runs: [{ text: 'b\\' }] },
      { type: 'list', list: 'bullet', runs: [{ text: 'c\\' }] },
      { type: 'list', list: 'bullet', runs: [{ text: 'd\\' }] },
      { type: 'paragraph', style: 'h2', runs: [{ text: 'e' }] },
      { type: 'list', list: 'bullet', runs: [{ text: 'f\\' }] },
    ]);
  });

  it('reads a long run of broken quote and item lines in budget', () => {
    const spaces = ' '.repeat(20_000);
    const quote = Array.from({ length: 2_000 }, () => `> x${spaces.slice(0, 9)}`).join('\n');
    const item = `- y${spaces}\n  ${'\\'.repeat(20_001)}\n  z`;
    let out: ArticleBlock[] = [];
    const took = cpuMsOf(() => {
      // The reader itself: a write refuses a paragraph this long before reading it (tooLong).
      out = [...parseMarkdownBlocks(quote), ...parseMarkdownBlocks(item)];
    });
    expect(out.map((b) => b.type)).toEqual(['paragraph', 'list']);
    // Measured under 10 ms: each line is scanned back from its end once.
    expect(took).toBeLessThan(cpuBudgetMs(250));
  });
});

describe('a written article read back', () => {
  it('keeps text that is bold and italic at once', () => {
    const runs = [
      { text: 'a ' },
      { text: 'both', b: true as const, i: true as const },
      { text: ' end' },
    ];
    const back = articleFromMarkdown(
      articleToMarkdown({ blocks: [{ id: 'p', type: 'paragraph', runs }] }),
    );
    expect(
      'blocks' in back && back.blocks.map((b) => (b.type === 'paragraph' ? b.runs : null)),
    ).toEqual([runs]);
  });

  it('keeps inline code holding backticks, backslashes and edge spaces', () => {
    for (const code of ['a`b', '``x', '`', 'x`', 'a ``` b', 'a\\*b \\`', ' padded ', '  ']) {
      const runs = [{ text: 'see ' }, { text: code, code: true as const }, { text: ' end' }];
      const back = articleFromMarkdown(
        articleToMarkdown({ blocks: [{ id: 'p', type: 'paragraph', runs }] }),
      );
      expect(
        'blocks' in back && back.blocks.map((b) => (b.type === 'paragraph' ? b.runs : null)),
        JSON.stringify(code),
      ).toEqual([runs]);
    }
  });

  const roundTrip = (blocks: ArticleBlock[]) => shape(blocksOf(articleToMarkdown({ blocks })));

  it('keeps a code block holding fence lines whole, and the text after it', () => {
    const blocks: ArticleBlock[] = [
      { id: 'c', type: 'code', text: 'Write:\n```js\nlet a;\n```\n````\nend' },
      { id: 'p', type: 'paragraph', runs: [{ text: 'after' }] },
    ];
    expect(roundTrip(blocks)).toEqual(shape(blocks));
    // A fence closes only on a line of backticks alone, at least as many as opened it.
    expect(shape(blocksOf('```\na\n```js\nb\n```'))).toEqual([
      { type: 'code', text: 'a\n```js\nb' },
    ]);
  });

  it('keeps a link whose address holds parentheses', () => {
    const href = 'https://en.wikipedia.org/wiki/Mercury_(planet)';
    const blocks: ArticleBlock[] = [
      { id: 'p', type: 'paragraph', runs: [{ text: 'Mercury', href }, { text: ' tail' }] },
    ];
    expect(roundTrip(blocks)).toEqual(shape(blocks));
  });

  it('keeps a link whose address holds a space, the space percent-encoded', () => {
    const blocks: ArticleBlock[] = [
      {
        id: 'p',
        type: 'paragraph',
        runs: [{ text: 'Notes', href: 'https://example.com/my notes\tdraft' }],
      },
    ];
    const markdown = articleToMarkdown({ blocks });
    expect(markdown).toBe('[Notes](https://example.com/my%20notes%09draft)\n');
    expect(roundTrip(blocks)).toEqual([
      {
        type: 'paragraph',
        runs: [{ text: 'Notes', href: 'https://example.com/my%20notes%09draft' }],
      },
    ]);
  });

  it("keeps inline code's link, bold and edge spaces", () => {
    const blocks: ArticleBlock[] = [
      {
        id: 'p',
        type: 'paragraph',
        runs: [
          { text: 'npm i', code: true, href: 'https://npmjs.com' },
          { text: ' then ' },
          { text: ' run ', code: true, b: true },
        ],
      },
    ];
    expect(roundTrip(blocks)).toEqual(shape(blocks));
  });

  it('keeps a title in quotes', () => {
    for (const title of ['"Quoted"', "'Single'", '"Mixed\'']) {
      const blocks: ArticleBlock[] = [
        { id: 't', type: 'paragraph', style: 'title', runs: [{ text: title }] },
      ];
      expect(roundTrip(blocks), title).toEqual(shape(blocks));
    }
  });

  it('keeps an opening divider, and what follows it, out of front matter', () => {
    const blocks: ArticleBlock[] = [
      { id: 'd1', type: 'divider' },
      { id: 'p', type: 'paragraph', runs: [{ text: 'Hello' }] },
      { id: 'd2', type: 'divider' },
      { id: 'q', type: 'paragraph', runs: [{ text: 'World' }] },
    ];
    expect(roundTrip(blocks)).toEqual(shape(blocks));
  });

  it("keeps a title's literal footnote marker and backslashes, beside a real footnote", () => {
    for (const text of ['See [^1]', 'a\\', 'C:\\docs\\[x]', '\\\\']) {
      const blocks: ArticleBlock[] = [
        {
          id: 't',
          type: 'paragraph',
          style: 'title',
          runs: [{ text }, { text: '*', fn: 'A note' }],
        },
        { id: 'p', type: 'paragraph', runs: [{ text: 'Body' }] },
      ];
      expect(roundTrip(blocks), text).toEqual(shape(blocks));
    }
    // A hand-written title's reference still reads as one.
    expect(shape(blocksOf('---\ntitle: Report[^n]\n---\n\nBody\n\n[^n]: Note\n'))[0]).toEqual({
      type: 'paragraph',
      style: 'title',
      runs: [{ text: 'Report' }, { text: '*', fn: 'Note' }],
    });
  });

  it('keeps the edge spaces of a paragraph, a heading, a quote and a list item', () => {
    const blocks: ArticleBlock[] = [
      { id: 'p', type: 'paragraph', runs: [{ text: '    indented\n  and broken  ' }] },
      { id: 'h', type: 'paragraph', style: 'h2', runs: [{ text: '  Heading' }] },
      { id: 'q', type: 'paragraph', style: 'quote', runs: [{ text: '  quoted ' }] },
      { id: 'l', type: 'list', list: 'bullet', runs: [{ text: '  item' }] },
      { id: 's', type: 'paragraph', runs: [{ text: '  ' }] },
      { id: 'r', type: 'paragraph', runs: [{ text: 'a literal &#32; stays' }] },
    ];
    expect(roundTrip(blocks)).toEqual(shape(blocks));
    // Written spaces count once toward a block's length, so a block that fits still fits read back.
    const wide: ArticleBlock[] = [
      {
        id: 'w',
        type: 'paragraph',
        runs: [{ text: `${' '.repeat(MAX_ARTICLE_BLOCK_TEXT - 2)}x` }],
      },
    ];
    expect(roundTrip(wide)).toEqual(shape(wide));
    // Inline code keeps a reference as written, as CommonMark does.
    expect(parseInline('`&#32;` &#32;x')).toEqual([{ text: '&#32;', code: true }, { text: '  x' }]);
  });
});

describe('a Markdown table', () => {
  const cellsOf = (b: ArticleBlock) =>
    b.type === 'table' ? b.rows.map((r) => r.cells.map((c) => c.map((x) => x.text).join(''))) : [];

  it('is a table block, its header line the header row; never inside a code fence', () => {
    const blocks = blocksOf(
      'Before\n\n| Method | Safe |\n| --- | :---: |\n| GET | yes |\n| POST | no |\n\nAfter\n\n```\n| a | b |\n|---|---|\n```',
    );
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'table', 'paragraph', 'code']);
    const table = blocks[1]!;
    expect(table.type === 'table' && table.header).toBe(true);
    expect(cellsOf(table)).toEqual([
      ['Method', 'Safe'],
      ['GET', 'yes'],
      ['POST', 'no'],
    ]);
  });

  it('takes a rule with or without outer pipes and alignment colons, and nothing else', () => {
    const tables = (rule: string) =>
      blocksOf(`| a | b |\n${rule}\n| 1 | 2 |`).filter((b) => b.type === 'table').length;
    for (const rule of ['|---|---|', '  | :--- | ---: |  ', ':---: | ---', '|----|'])
      expect(tables(rule), rule).toBe(1);
    for (const rule of ['| -- | --- |', '|---||', '||', '| --- | a |', '| :-:- |', '|', ''])
      expect(tables(rule), rule).toBe(0);
  });

  it('reads an empty header line as no header row, and keeps marks, bars and line breaks in cells', () => {
    const [table] = blocksOf('|  |  |\n|---|---|\n| **a** \\| b | one<br>two |');
    expect(table?.type === 'table' && table.header).toBeUndefined();
    if (table?.type !== 'table') throw new Error('no table');
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]!.cells[0]).toEqual([{ text: 'a', b: true }, { text: ' | b' }]);
    expect(table.rows[0]!.cells[1]).toEqual([{ text: 'one\ntwo' }]);
  });

  it('pads ragged rows to the widest', () => {
    const [table] = blocksOf('| a | b | c |\n|---|---|---|\n| 1 |');
    expect(cellsOf(table!)).toEqual([
      ['a', 'b', 'c'],
      ['1', '', ''],
    ]);
  });

  it('keeps a long table whole rather than refusing it as a long paragraph', () => {
    const row = `| ${'x'.repeat(90)} | y |`;
    const text = ['| a | b |', '|---|---|', ...Array.from({ length: 300 }, () => row)].join('\n');
    const out = articleFromMarkdown(text);
    expect('blocks' in out).toBe(true);
  });

  it('is written back as a pipe table and reads back the same', () => {
    const blocks = blocksOf(
      '| Name | Notes |\n|---|---|\n| [site](https://example.com) | a \\| b<br>c |\n| *x* | |',
    );
    const md = articleToMarkdown({ blocks });
    expect(md).toContain('| Name | Notes |\n| --- | --- |\n');
    expect(md).toContain('a \\| b<br>c');
    const back = blocksOf(md)[0]!;
    expect(cellsOf(back)).toEqual(cellsOf(blocks[0]!));
    expect(back.type === 'table' && back.rows[1]!.cells[0]).toEqual([
      { text: 'site', href: 'https://example.com' },
    ]);
  });

  it('writes a table with no header row with an empty header line', () => {
    const [table] = blocksOf('|  |  |\n|---|---|\n| 1 | 2 |');
    const md = articleToMarkdown({ blocks: [table!] });
    expect(md).toBe('|  |  |\n| --- | --- |\n| 1 | 2 |\n');
    expect(cellsOf(blocksOf(md)[0]!)).toEqual([['1', '2']]);
  });

  it('counts its cells as words', () => {
    expect(
      articleWordCount({ blocks: blocksOf('| one two | three |\n|---|---|\n| four | |') }),
    ).toBe(4);
  });
});

describe('a contents line', () => {
  it('reads [TOC] as a contents block, its depth from [TOC 1] or [TOC 2], and writes it back', () => {
    const blocks = blocksOf('[TOC]\n\n[TOC 2]\n\n[TOC 1]\n\n[TOC 3]');
    expect(shape(blocks)).toEqual([
      { type: 'toc' },
      { type: 'toc', depth: 2 },
      { type: 'toc', depth: 1 },
      { type: 'paragraph', runs: [{ text: '[TOC 3]' }] },
    ]);
    expect(articleToMarkdown({ blocks: blocks.slice(0, 3) })).toBe('[TOC]\n\n[TOC 2]\n\n[TOC 1]\n');
  });
});

describe('a paragraph too long for a block', () => {
  it('is refused rather than cut, a blank line resetting the count', () => {
    const half = 'x'.repeat(MAX_ARTICLE_BLOCK_TEXT / 2 + 10);
    expect(articleFromMarkdown(`${half}\n${half}`)).toEqual({ tooLong: true });
    expect('blocks' in articleFromMarkdown(`${half}\n\n${half}`)).toBe(true);
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

  it("prints an empty article as nothing, and a quote's line break as a hard break", () => {
    expect(articleToMarkdown({ blocks: [] })).toBe('');
    expect(
      articleToMarkdown({
        blocks: [{ id: 'a', type: 'paragraph', style: 'quote', runs: [{ text: 'a\nb' }] }],
      }),
    ).toBe('> a\\\n> b\n');
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
    let blocks: ReturnType<typeof blocksOf> = [];
    const took = cpuMsOf(() => {
      blocks = blocksOf(text);
    });
    expect(blocks.length).toBeGreaterThan(1000);
    // Measured 77 to 346 ms of wall time on a loaded machine; CPU time, so load never fails it.
    expect(took).toBeLessThan(cpuBudgetMs(1000));
  });

  it('reads a block of unclosed backtick fences in budget', () => {
    // Every fence length up to 190, none closed: each fence scans the rest of the line once.
    const line = Array.from({ length: 190 }, (_, i) => '`'.repeat(i + 1) + 'x').join('');
    const took = cpuMsOf(() => parseInline(line));
    // Measured 3 ms.
    expect(took).toBeLessThan(cpuBudgetMs(250));
  });

  it('writes and reads inline code of a long run of spaces in budget', () => {
    const code = ' ' + '!'.repeat(15_000) + ' !';
    let back: ReturnType<typeof articleFromMarkdown> = { error: '' } as never;
    const took = cpuMsOf(() => {
      back = articleFromMarkdown(
        articleToMarkdown({
          blocks: [{ id: 'p', type: 'paragraph', runs: [{ text: code, code: true }] }],
        }),
      );
    });
    // CodeQL's case for the edge-space check this replaced: quadratic as a regex.
    expect(took).toBeLessThan(cpuBudgetMs(250));
    expect('blocks' in back).toBe(true);
  });

  it('stays linear on a long run of spaces (no regex backtracking)', () => {
    const spaces = ' '.repeat(50_000);
    let md = '';
    let out: ReturnType<typeof articleFromMarkdown> = { error: '' } as never;
    const took = cpuMsOf(() => {
      md = articleToMarkdown({
        blocks: [{ id: 'p', type: 'paragraph', runs: [{ text: `${spaces}x${spaces}y`, b: true }] }],
      });
      out = articleFromMarkdown(`| a | b |\n|${spaces}x\n| 1 | 2 |`);
    });
    expect(md).toBe(`${'&#32;'.repeat(spaces.length)}**x${spaces}y**\n`);
    // Not a table rule, so the line stays a paragraph, then refused as longer than a block takes.
    expect('blocks' in out).toBe(false);
    // Measured under 5 ms; the quadratic regexes this guards took about 3 s each.
    expect(took).toBeLessThan(cpuBudgetMs(250));
  });
});
