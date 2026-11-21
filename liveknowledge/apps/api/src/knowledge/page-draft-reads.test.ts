import { describe, expect, it } from 'vitest';
import { readsDraft } from './page-draft-reads';
import { savedPageChanged } from './page-authors';

// docs/specs/030-knowledgebase/editing.md "What reads the saved page only"; "Save".

describe('who reads a draft', () => {
  const editor = { role: 'edit', community: false } as const;
  it("is an Editor's own editor, with no token, reading the plain tab", () => {
    expect(readsDraft({ token: null }, editor, false)).toBe(true);
  });
  it('never a Viewer, a Participant, a Community visitor, an agent or a document view', () => {
    expect(readsDraft({ token: null }, { role: 'view', community: false }, false)).toBe(false);
    expect(readsDraft({ token: null }, { role: 'participate' as never, community: false }, false)).toBe(false);
    expect(readsDraft({ token: null }, { role: 'edit', community: true }, false)).toBe(false);
    expect(readsDraft({ token: { id: 'tok' } }, editor, false)).toBe(false);
    expect(readsDraft({ token: null }, editor, true)).toBe(false);
  });
});

describe('a save that changes the page', () => {
  const writing = (text: string) => ({ 'art-1': { blocks: [{ id: 'a', type: 'paragraph', runs: [{ text }] }] } });
  const page = { name: 'P', elements: [], articles: writing('saved') };
  const drafted = (draftText: string, extra: object = {}) => ({
    ...page,
    articles: { ...page.articles, draft: writing(draftText)['art-1'] },
    draft: { by: 'Priya', at: 1, base: {} },
    ...extra,
  });

  it('counts every write with no draft either side, and a first write', () => {
    expect(savedPageChanged(page, page)).toBe(true);
    expect(savedPageChanged(null, drafted('x'))).toBe(true);
  });

  it("never counts a draft's autosave", () => {
    expect(savedPageChanged(page, drafted('x'))).toBe(false);
    expect(savedPageChanged(drafted('x'), drafted('y'))).toBe(false);
  });

  it('counts Save, a rename and an object changed under a draft', () => {
    expect(savedPageChanged(drafted('x'), { ...page, articles: writing('x') })).toBe(true);
    expect(savedPageChanged(drafted('x'), drafted('x', { name: 'Q' }))).toBe(true);
    expect(savedPageChanged(drafted('x'), drafted('x', { elements: [{ id: 'e' }] }))).toBe(true);
  });
});
