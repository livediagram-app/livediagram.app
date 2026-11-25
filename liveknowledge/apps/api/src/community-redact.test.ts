import { describe, expect, it } from 'vitest';
import { redactPageDataForCommunity, redactPageForCommunity } from './community-redact';

// docs/specs/025-community/community.md "Viewing a post's document": a page's people stay out of what a Community
// post's reader sees and of a copy through its link.
const knowledge = {
  owner: 'acct_owner',
  verifiedAt: 5,
  verifiedBy: 'acct_verifier',
  context: true,
  approval: {
    state: 'rejected',
    requestedBy: 'acct_asker',
    requestedAt: 4,
    requestedByName: 'Grace Hopper',
    decidedBy: 'acct_decider',
    decidedByName: 'Ada Lovelace',
    decidedAt: 6,
    note: 'Ask Ada',
  },
};
const thread = { id: 'e1', type: 'shape', commentThread: [{ id: 'c1', text: 'hi' }] };

describe('redactPageForCommunity', () => {
  it('keeps when the page was verified and Always in Context, and no person', () => {
    const out = redactPageForCommunity({ id: 'p1', elements: [thread], knowledge });
    expect(out).toEqual({
      id: 'p1',
      elements: [{ id: 'e1', type: 'shape' }],
      knowledge: { verifiedAt: 5, context: true },
    });
  });

  it('drops the field when nothing is left of it', () => {
    expect(redactPageForCommunity({ elements: [], knowledge: { owner: 'acct_owner' } })).toEqual({
      elements: [],
    });
  });
});

describe('redactPageDataForCommunity', () => {
  it("copies the page's writing without its people or its conversation", () => {
    const data = JSON.stringify({ elements: [thread], knowledge, articles: { a: { blocks: [] } } });
    const out = redactPageDataForCommunity(data);
    expect(out).not.toMatch(/acct_|Grace|Ada|commentThread/);
    expect(JSON.parse(out)).toEqual({
      elements: [{ id: 'e1', type: 'shape' }],
      knowledge: { verifiedAt: 5, context: true },
      articles: { a: { blocks: [] } },
    });
  });

  it('never copies a body it cannot read unredacted', () => {
    expect(redactPageDataForCommunity('{oops')).toBe('{"elements":[]}');
    expect(redactPageDataForCommunity('[1]')).toBe('{"elements":[]}');
    const out = redactPageDataForCommunity(JSON.stringify({ knowledge }));
    expect(JSON.parse(out)).toEqual({ knowledge: { verifiedAt: 5, context: true }, elements: [] });
  });
});
