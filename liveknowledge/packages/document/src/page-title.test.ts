import { describe, expect, it } from 'vitest';
import { articlesOf } from './article-flow';
import { KNOWLEDGEBASE_FLOW, newKnowledgebasePageContent } from './knowledgebase-page';
import type { Tab } from './tab-type';
import {
  pageFlowOf,
  pageTitleOf,
  titleNameOf,
  withNameFromTitle,
  withPageTitle,
} from './page-title';

const page = (): Tab => ({
  id: 't',
  name: 'Untitled Page',
  elements: [],
  ...newKnowledgebasePageContent(),
});
const placeholder: Tab = { id: 't', name: 'Release Process', elements: [] };

describe('a page’s title', () => {
  it('is the text of its Title block, empty until it is written', () => {
    expect(pageFlowOf(page())).toBe(KNOWLEDGEBASE_FLOW);
    expect(pageTitleOf(page())).toBe('');
    expect(pageTitleOf(withPageTitle(page(), 'Release Process'))).toBe('Release Process');
  });

  it('reads across the Title’s runs, trimmed and capped as a name is', () => {
    expect(
      titleNameOf([
        {
          id: 'b1',
          type: 'paragraph',
          style: 'title',
          runs: [{ text: ' Release ' }, { text: 'Process ', b: true }],
        },
      ]),
    ).toBe('Release Process');
    expect(titleNameOf([{ id: 'b1', type: 'paragraph', runs: [{ text: 'Body' }] }])).toBe('');
  });

  it('rewrites the Title alone, as plain text, leaving the rest of the writing as it was', () => {
    const before = page();
    const after = withPageTitle(before, 'Release Process');
    const [title, body] = articlesOf(after)[KNOWLEDGEBASE_FLOW]!.blocks;
    expect(title).toMatchObject({ style: 'title', runs: [{ text: 'Release Process' }] });
    expect(body).toEqual(articlesOf(before)[KNOWLEDGEBASE_FLOW]!.blocks[1]);
    expect(after.name).toBe(before.name);
  });

  it('is the same tab when the Title already says so, or the writing is not held here', () => {
    const named = withPageTitle(page(), 'Release Process');
    expect(withPageTitle(named, 'Release Process')).toBe(named);
    expect(withPageTitle(placeholder, 'Renamed')).toBe(placeholder);
    expect(pageTitleOf(placeholder)).toBe('');
    expect(pageFlowOf(placeholder)).toBeUndefined();
  });

  it('clears the Title for an empty name', () => {
    const cleared = withPageTitle(withPageTitle(page(), 'Release Process'), '');
    expect(articlesOf(cleared)[KNOWLEDGEBASE_FLOW]!.blocks[0]).toMatchObject({ runs: [] });
  });
});

// A page stored before its pages were: its one article is its writing.
it("takes a tab's one article where no page names it", () => {
  const old: Tab = {
    id: 'o',
    name: 'Old',
    elements: [],
    articles: {
      f1: { blocks: [{ id: 'b1', type: 'paragraph', style: 'title', runs: [{ text: 'Old' }] }] },
    },
  };
  expect(pageFlowOf(old)).toBe('f1');
  expect(pageTitleOf(old)).toBe('Old');
});

// docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Name"
describe('withNameFromTitle', () => {
  it('names the page after a Title that changed, empty when it was emptied', () => {
    const before = withPageTitle(page(), 'Notes');
    const typed = withPageTitle(before, 'Release Notes');
    expect(withNameFromTitle(before, typed).name).toBe('Release Notes');
    expect(withNameFromTitle(typed, withPageTitle(typed, '')).name).toBe('');
  });

  it('keeps the name where the Title did not change, or was never written', () => {
    const made = { ...page(), name: 'Start Here' };
    expect(withNameFromTitle(made, made)).toBe(made);
    const elsewhere = { ...made, elements: [] };
    expect(withNameFromTitle(made, elsewhere)).toBe(elsewhere);
  });

  it('leaves a tab whose writing is not held, or that already has the name', () => {
    const bare: Tab = { id: 't', name: 'Kept', elements: [] };
    expect(withNameFromTitle(page(), bare)).toBe(bare);
    const named = { ...withPageTitle(page(), 'Same'), name: 'Same' };
    expect(withNameFromTitle(page(), named)).toBe(named);
  });
});
