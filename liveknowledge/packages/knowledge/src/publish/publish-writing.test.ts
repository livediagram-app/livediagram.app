// A page's saved writing as the public site draws it (docs/specs/030-knowledgebase/blueprints/publishing.md P11 to
// P13, P22): safe HTML from the blocks, and nothing private.
import { describe, expect, it } from 'vitest';
import type { ArticleBlock, ArticleRun } from '@liveknowledge/document';
import {
  describe as describeText,
  escapeHtml,
  publishedWriting,
  joinLines,
  PUBLISHED_DESCRIPTION_MAX,
} from './publish-writing';

const p = (runs: ArticleRun[], extra: Record<string, unknown> = {}): ArticleBlock => ({
  id: `b${Math.random()}`,
  type: 'paragraph',
  runs,
  ...extra,
});
const t = (text: string): ArticleRun => ({ text });
const li = (
  list: 'bullet' | 'numbered' | 'todo',
  text: string,
  extra: Record<string, unknown> = {},
) => ({ id: `l${Math.random()}`, type: 'list', list, runs: [t(text)], ...extra }) as ArticleBlock;
const none = () => null;

describe('publishedWriting', () => {
  it('leaves out the title, steps headings down and anchors them once each', () => {
    const { html, text } = publishedWriting(
      [
        p([t('The Title')], { style: 'title' }),
        p([t('Intro')], { style: 'h1' }),
        p([t('Intro')], { style: 'h2', align: 'center' }),
        p([t('Deep')], { style: 'h3' }),
        p([t('Second title')], { style: 'title', align: 'right' }),
        p([t('Lead')], { style: 'subtitle' }),
        p([t('Said')], { style: 'quote' }),
        p([t('Plain')], { align: 'left' }),
      ],
      none,
    );
    expect(html).not.toContain('The Title');
    expect(html).toContain('<h2 id="intro">Intro</h2>');
    expect(html).toContain('<h3 id="intro-2" style="text-align:center">Intro</h3>');
    expect(html).toContain('<h4 id="deep">Deep</h4>');
    expect(html).toContain('<h2 style="text-align:right">Second title</h2>');
    expect(html).toContain('<p class="lead">Lead</p>');
    expect(html).toContain('<blockquote><p>Said</p></blockquote>');
    expect(html).toContain('<p>Plain</p>');
    expect(text.startsWith('Intro')).toBe(true);
  });

  it('draws every mark, escapes text, and keeps only safe links', () => {
    const { html } = publishedWriting(
      [
        p([
          { text: 'x<y>\nz', b: true, i: true, u: true, s: true, code: true, sup: true },
          { text: 'low', sub: true },
          { text: 'red', color: '#ff0000', hl: '#ffff00' },
          { text: 'bad', color: 'red;background:url(x)' },
          { text: 'web', href: ' https://example.com/a?b="c" ' },
          { text: 'js', href: 'javascript:alert(1)' },
          { text: 'noted', note: 'margin-1' },
          { text: 'there', page: 'tab-2' } as ArticleRun,
          { text: 'private', page: 'tab-3' } as ArticleRun,
        ]),
      ],
      (tab) => (tab === 'tab-2' ? '/kb/acme/there' : null),
    );
    expect(html).toContain(
      '<code><strong><em><u><s><sup>x&lt;y&gt;<br>z</sup></s></u></em></strong></code>',
    );
    expect(html).toContain('<sub>low</sub>');
    expect(html).toContain('<span style="color:#ff0000;background-color:#ffff00">red</span>');
    expect(html).toContain('bad');
    expect(html).not.toContain('url(x)');
    expect(html).toContain(
      '<a href="https://example.com/a?b=&quot;c&quot;" rel="noopener">web</a>',
    );
    expect(html).not.toContain('javascript');
    expect(html).toContain('noted');
    expect(html).not.toContain('margin-1');
    expect(html).toContain('<a href="/kb/acme/there">there</a>');
    expect(html).toContain('private');
    expect(html).not.toContain('tab-3');
  });

  it('numbers footnotes and lists them at the foot', () => {
    const { html } = publishedWriting(
      [p([t('Claim'), { text: '⁠⁠', fn: 'Source <1>' }, t('.')])],
      none,
    );
    expect(html).toContain('<sup class="fn"><a href="#fn-1" id="fnref-1">1</a></sup>');
    expect(html).toContain('<a href="#fn-2" id="fnref-2">2</a>');
    expect(html).toContain(
      '<ol class="footnotes"><li id="fn-1">Source &lt;1&gt; <a href="#fnref-1"',
    );
  });

  it('nests lists by level, switches kinds and ticks todos', () => {
    const { html } = publishedWriting(
      [
        li('bullet', 'one'),
        li('bullet', 'two'),
        li('bullet', 'two-a', { level: 1 }),
        li('bullet', 'two-b', { level: 1 }),
        li('bullet', 'three'),
        li('numbered', 'first'),
        li('todo', 'done', { checked: true }),
        li('todo', 'open', { level: 2.7 }),
        p([t('after')]),
        li('numbered', 'last'),
      ],
      none,
    );
    expect(html).toContain(
      '<ul><li>one</li><li>two<ul><li>two-a</li><li>two-b</li></ul></li><li>three</li></ul><ol><li>first</li></ol>',
    );
    expect(html).toContain(
      '<ul class="todo"><li><input type="checkbox" disabled checked aria-label="Done"> done<ul class="todo"><li><input type="checkbox" disabled aria-label="Not done"> open</li></ul></li></ul><p>after</p>',
    );
    expect(html.endsWith('<ol><li>last</li></ol>')).toBe(true);
  });

  it('draws code, dividers, tables and contents, and nothing for zones or page breaks', () => {
    const blocks = [
      { id: 'c', type: 'code', text: 'a < b', lang: 'js' },
      { id: 'c2', type: 'code', text: 'plain' },
      { id: 'd', type: 'divider' },
      {
        id: 't',
        type: 'table',
        header: true,
        cols: [],
        rows: [
          { id: 'r1', cells: [[t('Name')], [t('Role')]] },
          { id: 'r2', cells: [[t('Ana')], [t('Lead')]] },
        ],
      },
      { id: 't2', type: 'table', cols: [], rows: [{ id: 'r', cells: [[t('cell')]] }] },
      { id: 't3', type: 'table', header: true, cols: [], rows: [] },
      { id: 'toc', type: 'toc', depth: 1 },
      { id: 'toc2', type: 'toc' },
      p([t('Top')], { style: 'h1' }),
      p([t('Sub')], { style: 'h2' }),
      { id: 'z', type: 'zone', zone: 'image', width: 1, height: 1 },
      { id: 'pb', type: 'pageBreak' },
    ] as unknown as ArticleBlock[];
    const { html } = publishedWriting(blocks, none);
    expect(html).toContain('<pre><code class="language-js">a &lt; b</code></pre>');
    expect(html).toContain('<pre><code>plain</code></pre>');
    expect(html).toContain('<hr>');
    expect(html).toContain(
      '<div class="table"><table><thead><tr><th>Name</th><th>Role</th></tr></thead><tbody><tr><td>Ana</td><td>Lead</td></tr></tbody></table></div>',
    );
    expect(html).toContain('<tbody><tr><td>cell</td></tr></tbody>');
    expect(html).toContain(
      '<nav class="toc" aria-label="Contents"><ol><li class="toc-1"><a href="#top">Top</a></li></ol></nav>',
    );
    expect(html).toContain('<li class="toc-2"><a href="#sub">Sub</a></li>');
    expect(html).not.toContain('zone');
    // A contents block with no heading to list draws nothing.
    expect(publishedWriting([{ id: 'x', type: 'toc' }], none).html).toBe('');
  });

  it('draws each zone as the figure its caller made, in its place, and nothing where it made none (P31)', () => {
    const blocks = [
      p([t('Before.')]),
      { id: 'z1', type: 'zone', zone: 'object', width: 10, height: 10 },
      { id: 'z2', type: 'zone', zone: 'drawing', width: 10, height: 10 },
      p([t('After.')]),
    ] as unknown as ArticleBlock[];
    const asked: string[] = [];
    const { html, text } = publishedWriting(blocks, none, (zone) => {
      asked.push(zone.id);
      return zone.id === 'z1' ? '<figure class="zone">one</figure>' : null;
    });
    expect(asked).toEqual(['z1', 'z2']);
    expect(html).toBe('<p>Before.</p><figure class="zone">one</figure><p>After.</p>');
    // A figure is no words: search and the description read the writing alone.
    expect(text).toBe('Before.\nAfter.');
  });

  it('finds no words in an empty page', () => {
    expect(
      publishedWriting([p([t('Only a title')], { style: 'title' }), p([t('  ')])], none),
    ).toEqual({
      html: '<p>  </p>',
      text: '',
      description: '',
    });
  });
});

describe('the text', () => {
  it('keeps a heading apart from the line after it, and a sentence as it is', () => {
    expect(joinLines(['How and when changes are released.', 'Before a Release', 'Releasing'])).toBe(
      'How and when changes are released.\nBefore a Release ·\nReleasing',
    );
    expect(joinLines(['Ready?', 'Yes!', 'Steps:', 'One;', 'Then…', 'Done'])).toBe(
      'Ready?\nYes!\nSteps:\nOne;\nThen…\nDone',
    );
    expect(joinLines([])).toBe('');
    const { text, description } = publishedWriting(
      [p([t('Before a Release')], { style: 'h1' }), p([t('Releasing')], { style: 'h1' })],
      none,
    );
    expect(text).toBe('Before a Release ·\nReleasing');
    expect(description).toBe('Before a Release · Releasing');
  });
});

describe('the description', () => {
  it('collapses whitespace and cuts at a word', () => {
    expect(describeText('  a \n\t b\r ')).toBe('a b');
    const long = `${'word '.repeat(60)}`;
    const cut = describeText(long);
    expect(cut.length).toBeLessThanOrEqual(PUBLISHED_DESCRIPTION_MAX);
    expect(cut.endsWith('word…')).toBe(true);
    const unbroken = describeText('x'.repeat(400));
    expect(unbroken).toBe(`${'x'.repeat(PUBLISHED_DESCRIPTION_MAX - 1)}…`);
  });

  it('escapes every character HTML reads', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });
});
