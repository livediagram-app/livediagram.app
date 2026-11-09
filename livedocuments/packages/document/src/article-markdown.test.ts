import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import {
  looksLikeMarkdown,
  parseInline,
  parseMarkdownBlocks,
  plainTextBlocks,
} from './article-markdown';

// docs/specs/007-editor/article-pages.md "Writing": a paste of Markdown becomes the blocks it means.
const shape = (text: string) =>
  parseMarkdownBlocks(text).map(({ id: _id, ...b }) => {
    void _id;
    return b;
  });

describe('Markdown pasted into an article', () => {
  it('reads headings, lists by indent, to-dos, quotes, code and dividers', () => {
    expect(
      shape(
        [
          '# Plan',
          'First line',
          'joins the second.',
          '',
          '- one',
          '  - nested',
          '1. step',
          '- [x] done',
          '- [ ] open',
          '> said',
          '```',
          'a = 1',
          '```',
          '---',
        ].join('\n'),
      ),
    ).toEqual([
      { type: 'paragraph', style: 'h1', runs: [{ text: 'Plan' }] },
      { type: 'paragraph', runs: [{ text: 'First line joins the second.' }] },
      { type: 'list', list: 'bullet', runs: [{ text: 'one' }] },
      { type: 'list', list: 'bullet', level: 1, runs: [{ text: 'nested' }] },
      { type: 'list', list: 'numbered', runs: [{ text: 'step' }] },
      { type: 'list', list: 'todo', checked: true, runs: [{ text: 'done' }] },
      { type: 'list', list: 'todo', runs: [{ text: 'open' }] },
      { type: 'paragraph', style: 'quote', runs: [{ text: 'said' }] },
      { type: 'code', text: 'a = 1' },
      { type: 'divider' },
    ]);
  });

  it('reads inline formats and safe links only', () => {
    expect(parseInline('a **b** *c* ~~d~~ `e` [f](https://x.dev) [g](javascript:x)')).toEqual([
      { text: 'a ' },
      { text: 'b', b: true },
      { text: ' ' },
      { text: 'c', i: true },
      { text: ' ' },
      { text: 'd', s: true },
      { text: ' ' },
      { text: 'e', code: true },
      { text: ' ' },
      { text: 'f', href: 'https://x.dev' },
      { text: ' g' },
    ]);
  });

  // `***x***` is bold and italic at once, as every Markdown writes it (this file's own writer too): it read as a
  // literal `*`, bold text and another `*`, so the italic was lost and two stars were left in the words.
  it('reads triple stars and underscores as bold and italic at once', () => {
    expect(parseInline('a ***b*** c')).toEqual([
      { text: 'a ' },
      { text: 'b', b: true, i: true },
      { text: ' c' },
    ]);
    expect(parseInline('___b___')).toEqual([{ text: 'b', b: true, i: true }]);
    expect(parseInline('*x****y***')).toEqual([
      { text: 'x', i: true },
      { text: 'y', b: true, i: true },
    ]);
  });

  it('reads no emphasis from an underscore inside a word, as CommonMark', () => {
    expect(parseInline('snake_case_name and my__private__helper or a___b___c')).toEqual([
      { text: 'snake_case_name and my__private__helper or a___b___c' },
    ]);
    expect(parseInline('a_b _c_ (__d__) é_x_')).toEqual([
      { text: 'a_b ' },
      { text: 'c', i: true },
      { text: ' (' },
      { text: 'd', b: true },
      { text: ') é_x_' },
    ]);
  });

  it('tells Markdown from plain text, which pastes a paragraph a line', () => {
    expect(looksLikeMarkdown('## Heading')).toBe(true);
    expect(looksLikeMarkdown('Dear team,\nthanks for today.')).toBe(false);
    expect(plainTextBlocks('a\n\nb').map((b) => b.type === 'paragraph' && b.runs[0]!.text)).toEqual(
      ['a', 'b'],
    );
  });
});

describe('hard line breaks', () => {
  it('breaks a paragraph line ending in two or more spaces or a backslash', () => {
    expect(shape('Jordan Blake  \nHarbour Coffee\\\nBristol   \nBS8 1AA')).toEqual([
      { type: 'paragraph', runs: [{ text: 'Jordan Blake\nHarbour Coffee\nBristol\nBS8 1AA' }] },
    ]);
  });

  it('joins a line with one trailing space, an escaped backslash or a backslash then a space', () => {
    expect(shape('one \ntwo\\\\\nthree\\ \nfour')).toEqual([
      { type: 'paragraph', runs: [{ text: 'one two\\ three\\ four' }] },
    ]);
  });

  it('keeps the last line literal: its spaces go, its backslash stays', () => {
    expect(shape('a  \n\nb\\')).toEqual([
      { type: 'paragraph', runs: [{ text: 'a' }] },
      { type: 'paragraph', runs: [{ text: 'b\\' }] },
    ]);
  });

  it('keeps inline marks across a break', () => {
    expect(shape('**bold\\\nstill bold** plain')).toEqual([
      {
        type: 'paragraph',
        runs: [{ text: 'bold\nstill bold', b: true }, { text: ' plain' }],
      },
    ]);
  });

  it('reads a line of 50,000 spaces, and lines ending in them, in linear time', () => {
    const spaces = ' '.repeat(50_000);
    const ms = cpuMsOf(() => {
      expect(shape(`a\n${spaces}\nb`)).toHaveLength(2);
      expect(shape(`a${spaces}\nb${spaces}x\nc\\${spaces}`)).toHaveLength(1);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(50));
  });
});

describe('pasted tables and contents', () => {
  it('recognises a pipe table or a [TOC] line as Markdown, and plain bars as not', () => {
    expect(looksLikeMarkdown('| a | b |\n|---|---|\n| 1 | 2 |')).toBe(true);
    expect(looksLikeMarkdown('[TOC]')).toBe(true);
    expect(looksLikeMarkdown('| a | b |\n| 1 | 2 |')).toBe(false);
  });

  it('tells Markdown in linear time on runs of brackets', () => {
    const brackets = `x${'['.repeat(50_000)}`;
    const links = `x${'[a]('.repeat(20_000)}`;
    const ms = cpuMsOf(() => {
      expect(looksLikeMarkdown(brackets)).toBe(false);
      expect(looksLikeMarkdown(links)).toBe(false);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(50));
  });

  it('reads a pipe table as a table block', () => {
    const [table] = parseMarkdownBlocks('| a | b |\n:---: | ---\n| 1 | 2 |');
    if (table?.type !== 'table') throw new Error('no table');
    expect(table.header).toBe(true);
    expect(table.cols).toHaveLength(2);
    expect(table.rows.map((r) => r.cells.map((c) => c[0]?.text ?? ''))).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('keeps an all-empty header table with no body as one empty row', () => {
    const [table] = parseMarkdownBlocks('|  |  |\n|---|---|');
    expect(table?.type === 'table' && table.rows).toHaveLength(1);
  });

  it('reads [TOC] lines as contents blocks', () => {
    expect(shape('# A\n\n[TOC 2]')).toEqual([
      { type: 'paragraph', style: 'h1', runs: [{ text: 'A' }] },
      { type: 'toc', depth: 2 },
    ]);
  });
});
