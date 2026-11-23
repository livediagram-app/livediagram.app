import { describe, expect, it } from 'vitest';
import {
  forgetKnowledgeTiersForTests,
  setKnowledgeTier,
  setOpenPagesBound,
} from '@/lib/knowledge-tier';
import type { Element, Tab } from '@liveknowledge/document';
import {
  deletePageMessage,
  deletePageTitle,
  pageAfterDelete,
  pageTreeRefusalText,
  withPageAddedTo,
  withPageAndSubpagesDeleted,
  withPageDuplicated,
} from './page-tree-edits';

const tab = (id: string, parent?: string, elements: Element[] = []): Tab => ({
  id,
  name: id,
  elements,
  ...(parent ? { parent } : {}),
});
// a > (b > d, c), e
const TABS = [tab('a'), tab('b', 'a'), tab('d', 'b'), tab('c', 'a'), tab('e')];
const shape = (tabs: Tab[]) =>
  tabs.map((t) => `${t.id}${t.parent ? `<${t.parent}` : ''}`).join(' ');

describe('withPageAddedTo', () => {
  it('adds at the top level, or as a parent’s last subpage', () => {
    expect(shape(withPageAddedTo(TABS, tab('n')))).toBe('a b<a d<b c<a e n');
    expect(shape(withPageAddedTo(TABS, tab('n'), 'b'))).toBe('a b<a d<b n<b c<a e');
  });
  it('is the same list when the tree refuses', () => {
    expect(withPageAddedTo(TABS, tab('n'), 'gone')).toBe(TABS);
  });
});

describe('withPageDuplicated', () => {
  it('places the copy just after the original’s subpages, under the same parent', () => {
    expect(shape(withPageDuplicated(TABS, 'b', tab('n')))).toBe('a b<a d<b n<a c<a e');
    expect(shape(withPageDuplicated(TABS, 'a', tab('n')))).toBe('a b<a d<b c<a n e');
    // The last of its siblings: the copy is the last.
    expect(shape(withPageDuplicated(TABS, 'e', tab('n')))).toBe('a b<a d<b c<a e n');
  });
  it('is the same list for a page not there', () => {
    expect(withPageDuplicated(TABS, 'gone', tab('n'))).toBe(TABS);
  });
});

describe('withPageAndSubpagesDeleted', () => {
  const linkTo = (tabId: string): Element =>
    ({ id: `l-${tabId}`, type: 'text', link: { kind: 'tab', tabId } }) as unknown as Element;
  const url = {
    id: 'u',
    type: 'text',
    link: { kind: 'url', url: 'https://x.test' },
  } as unknown as Element;

  it('removes the page with every page under it', () => {
    expect(shape(withPageAndSubpagesDeleted(TABS, 'a'))).toBe('e');
    expect(shape(withPageAndSubpagesDeleted(TABS, 'b'))).toBe('a c<a e');
  });

  it('strips the links that pointed at a deleted page or subpage, and no others', () => {
    const tabs = [
      ...TABS.slice(0, 4),
      tab('e', undefined, [linkTo('b'), linkTo('d'), linkTo('c'), url]),
    ];
    const left = withPageAndSubpagesDeleted(tabs, 'b');
    const links = left.find((t) => t.id === 'e')!.elements.map((el) => el.link?.kind ?? null);
    expect(links).toEqual([null, null, 'tab', 'url']);
    // A page with no such link is the same object.
    expect(left.find((t) => t.id === 'a')).toBe(tabs[0]);
  });

  it('is the same list when no page would be left', () => {
    const only = [tab('a'), tab('b', 'a')];
    expect(withPageAndSubpagesDeleted(only, 'a')).toBe(only);
  });
});

describe('pageAfterDelete', () => {
  it('is the next page after the deleted ones, else the one before', () => {
    expect(pageAfterDelete(TABS, 'b')).toBe('c');
    expect(pageAfterDelete(TABS, 'a')).toBe('e');
    expect(pageAfterDelete(TABS, 'e')).toBe('c');
    expect(pageAfterDelete(TABS, 'gone')).toBeUndefined();
  });
});

describe('what a person reads', () => {
  it('names the count in the delete confirmation', () => {
    expect(deletePageTitle('Release Process', 3)).toBe('Delete Release Process and 3 Subpages?');
    expect(deletePageTitle('Release Process', 1)).toBe('Delete Release Process and 1 Subpage?');
    expect(deletePageTitle('Release Process', 0)).toBe('Delete Release Process?');
    expect(deletePageTitle(' ', 0)).toBe('Delete This Page?');
    expect(deletePageTitle('Release Process', 3, true)).toBe(
      'Move Release Process and 3 Subpages to the Trash?',
    );
    expect(deletePageTitle('Release Process', 0, true)).toBe('Move Release Process to the Trash?');
  });
  it("says where a delete goes: the Trash, or (an Offline knowledgebase's) Undo alone", () => {
    expect(deletePageMessage(0, true)).toContain('restore it from the Trash for 30 days');
    expect(deletePageMessage(2, true)).toContain('restore them from the Trash for 30 days');
    expect(deletePageMessage(0, false)).toBe(
      'The page is removed for everyone. Undo (Cmd/Ctrl-Z) brings it back.',
    );
    expect(deletePageMessage(2, false)).toContain('The page and its subpages are removed');
  });
  it('says why the tree refuses', () => {
    expect(pageTreeRefusalText('page_limit')).toBe('A knowledgebase holds 500 pages at most.');
    // At the owner's Knowledgebase Pages, the notice's own words.
    setKnowledgeTier('kb', { pagesMax: 500, pagesLimit: 500, historyDays: 30 });
    setOpenPagesBound('kb', { max: 3, account: { limit: 500, whose: 'yours' } });
    expect(pageTreeRefusalText('page_limit')).toBe(
      'You have 500 pages, the most Free holds across your Knowledgebases.',
    );
    forgetKnowledgeTiersForTests();
    expect(pageTreeRefusalText('depth_limit')).toBe('Pages nest 8 levels deep at most.');
    expect(pageTreeRefusalText('own_subtree')).toBe('A page cannot move inside its own subpages.');
    expect(pageTreeRefusalText('unknown_page')).toBe('That page is no longer here.');
  });
});
