import { describe, expect, it } from 'vitest';
import {
  ARTICLE_MARKDOWN_MAX,
  articlesOf,
  articleTitleOf,
  articleToMarkdown,
  isKnowledgebasePage,
  isValidTab,
} from '@liveknowledge/document';
import { newPageFromMarkdown, withTitleFrontMatter } from './new-page';

const flowOf = (tab: object) => Object.values(articlesOf(tab))[0]!;

describe('withTitleFrontMatter', () => {
  it('opens the writing with the title', () => {
    expect(withTitleFrontMatter('  Deploys\n today ', 'Body.')).toBe(
      '---\ntitle: Deploys today\n---\n\nBody.',
    );
  });

  it('keeps front matter the Markdown brings', () => {
    const own = '---\ntitle: Mine\n---\n\nBody.';
    expect(withTitleFrontMatter('Other', own)).toBe(own);
  });

  it('writes a quoted title and a footnote mark so they read back as given', () => {
    expect(withTitleFrontMatter('"Quoted"', 'x')).toContain(`title: '"Quoted"'`);
    expect(withTitleFrontMatter("'Quoted'", 'x')).toContain(`title: "'Quoted'"`);
    expect(withTitleFrontMatter('See [^1]', 'x')).toContain('title: See \\[^1]');
  });
});

describe('newPageFromMarkdown', () => {
  it('makes a knowledgebase page whose writing opens with its title', () => {
    const made = newPageFromMarkdown({
      id: 'p1',
      title: 'Deploys',
      markdown: '## When\n\nOn Tuesdays.',
      parent: 'ops',
    });
    if ('refusal' in made) throw new Error(made.refusal.message);
    expect(made.tab).toMatchObject({ id: 'p1', name: 'Deploys', parent: 'ops' });
    expect(isValidTab(made.tab)).toBe(true);
    expect(isKnowledgebasePage(made.tab)).toBe(true);
    expect(articleTitleOf(flowOf(made.tab))).toBe('Deploys');
    expect(articleToMarkdown(flowOf(made.tab))).toContain('On Tuesdays.');
  });

  it('links [[Title]] to the page the lookup finds', () => {
    const made = newPageFromMarkdown(
      { id: 'p1', title: 'Hotfixes', markdown: 'See [[Deploys]] and [[Nowhere]].' },
      { pageByTitle: (title) => (title === 'Deploys' ? 'deploys' : undefined) },
    );
    if ('refusal' in made) throw new Error(made.refusal.message);
    const runs = flowOf(made.tab).blocks.flatMap((b) => ('runs' in b ? b.runs : []));
    expect(runs.find((r) => r.text === 'Deploys')).toMatchObject({ page: 'deploys' });
    expect(runs.some((r) => 'page' in r && r.text.includes('Nowhere'))).toBe(false);
  });

  // docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Name": the Title is the page's name, with or without
  // writing.
  it('gives a page with no Markdown its title as its Title, and an empty first paragraph', () => {
    const made = newPageFromMarkdown({ id: 'p1', title: 'Later', markdown: '  ' });
    if ('refusal' in made) throw new Error(made.refusal.message);
    expect(made.tab.parent).toBeUndefined();
    expect(isKnowledgebasePage(made.tab)).toBe(true);
    expect(articleTitleOf(flowOf(made.tab))).toBe('Later');
    expect(made.tab.name).toBe('Later');
    expect(flowOf(made.tab).blocks.at(-1)).toMatchObject({ type: 'paragraph', runs: [] });
    expect('refusal' in newPageFromMarkdown({ id: 'p2', title: 'Later' })).toBe(false);
  });

  it('answers the refusal of Markdown the article write does not take', () => {
    const made = newPageFromMarkdown({
      id: 'p1',
      title: 'Huge',
      markdown: 'x'.repeat(ARTICLE_MARKDOWN_MAX + 1),
    });
    expect('refusal' in made && made.refusal.code).toBeTruthy();
  });
});
