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

  it('tells Markdown from plain text, which pastes a paragraph a line', () => {
    expect(looksLikeMarkdown('## Heading')).toBe(true);
    expect(looksLikeMarkdown('Dear team,\nthanks for today.')).toBe(false);
    expect(plainTextBlocks('a\n\nb').map((b) => b.type === 'paragraph' && b.runs[0]!.text)).toEqual(
      ['a', 'b'],
    );
  });
});
