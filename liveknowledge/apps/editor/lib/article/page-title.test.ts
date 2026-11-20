import { describe, expect, it } from 'vitest';
import {
  articlesOf,
  KNOWLEDGEBASE_FLOW,
  newKnowledgebasePageContent,
  type Tab,
} from '@liveknowledge/document';
import { pageFlowOf, pageTitleOf, titleNameOf, withPageTitle } from './page-title';

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
