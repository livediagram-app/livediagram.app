import { describe, expect, it } from 'vitest';
import { newKnowledgebasePageContent, articlesOf, withPageTitle } from '@liveknowledge/document';
import { blocksToDoc } from './article-convert';
import { focusSelection } from './article-focus-selection';

// Where a request for the caret lands (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Add": a new page
// opens with the caret in its title).
const docOf = (title: string) => {
  const base = {
    id: 'p',
    name: title || 'Untitled Page',
    elements: [],
    ...newKnowledgebasePageContent(),
  };
  const tab = title ? withPageTitle(base, title) : base;
  return blocksToDoc(Object.values(articlesOf(tab))[0]!.blocks);
};

describe('focusSelection', () => {
  it("puts the caret in an empty page's Title", () => {
    const doc = docOf('');
    const sel = focusSelection(doc, 'title');
    expect(sel.empty).toBe(true);
    expect(sel.$from.parent).toBe(doc.firstChild);
    expect(sel.$from.parent.attrs.style).toBe('title');
  });

  it("puts it at the end of a named page's Title", () => {
    const doc = docOf('Release Process');
    const sel = focusSelection(doc, 'title');
    expect(sel.$from.parent).toBe(doc.firstChild);
    expect(sel.$from.parentOffset).toBe('Release Process'.length);
  });

  it('start and end are the writing’s own', () => {
    const doc = docOf('Release Process');
    expect(focusSelection(doc, 'start').from).toBe(1);
    expect(focusSelection(doc, 'end').to).toBe(doc.content.size - 1);
  });
});
