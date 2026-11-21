import { describe, expect, it } from 'vitest';
import type { Tab } from '@liveknowledge/document';
import { withCreatorOwner } from './new-page-owner';

const tab = (id: string, knowledge?: Tab['knowledge']): Tab => ({
  id,
  name: id,
  elements: [],
  ...(knowledge ? { knowledge } : {}),
});

// docs/specs/030-knowledgebase/verification.md "The owner": a new page's creator is its owner.
describe('withCreatorOwner', () => {
  it('makes the signed-in creator the owner of every seeded page', () => {
    const made = withCreatorOwner([tab('a'), tab('b', { verifiedAt: 5 })], 'user-1');
    expect(made.map((t) => t.knowledge)).toEqual([
      { owner: 'user-1' },
      { verifiedAt: 5, owner: 'user-1' },
    ]);
  });

  it('keeps an owner a page already has', () => {
    expect(withCreatorOwner([tab('a', { owner: 'someone' })], 'user-1')[0]!.knowledge).toEqual({
      owner: 'someone',
    });
  });

  it('leaves the pages as they are with no signed-in creator (a guest, Offline)', () => {
    const pages = [tab('a')];
    expect(withCreatorOwner(pages, null)).toEqual(pages);
  });
});
