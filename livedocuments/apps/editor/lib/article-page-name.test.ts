// An unnamed article page's or card's name is its article's title (docs/specs/007-editor/pages-mode.md "Page names").
import { describe, expect, it } from 'vitest';
import type { ArticleFlow } from '@livedocuments/document';
import { articleOwnTitle, articleTitlesOf, shownPageName } from './article-page-name';

const flow = (style: string, text: string): ArticleFlow =>
  ({ blocks: [{ type: 'paragraph', style, runs: [{ text }] }] }) as unknown as ArticleFlow;

describe('the name an article page or card goes by', () => {
  it("is its article's title, or its first heading, never the 'Untitled' stand-in", () => {
    expect(articleOwnTitle(flow('title', '  Opening '))).toBe('Opening');
    expect(articleOwnTitle(flow('h1', 'Chapter One'))).toBe('Chapter One');
    expect(articleOwnTitle({ blocks: [] })).toBeUndefined();
    expect(articleOwnTitle(undefined)).toBeUndefined();
  });

  it("is the page's own name first, then its article's title, then none", () => {
    const titles = articleTitlesOf({ f1: flow('title', 'Opening'), f2: { blocks: [] } });
    expect([...titles]).toEqual([['f1', 'Opening']]);
    expect(shownPageName({ name: 'Intro', flow: 'f1' }, titles)).toBe('Intro');
    expect(shownPageName({ name: '  ', flow: 'f1' }, titles)).toBe('Opening');
    expect(shownPageName({ flow: 'f2' }, titles)).toBeUndefined();
    expect(shownPageName({}, titles)).toBeUndefined();
    expect(articleTitlesOf(undefined).size).toBe(0);
  });
});
