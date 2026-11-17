import { describe, expect, it } from 'vitest';
import { mentionedByOf, mentionIdsOf, withMentionedBy } from './thread-mentioners';

type C = {
  createdAt: number;
  authorId?: string;
  authorName: string;
  authorColor?: string;
  mentions?: { userId?: string | null; memberId?: string }[];
};

const ada = (at: number, mentions: C['mentions'] = []): C => ({
  createdAt: at,
  authorId: 'user_ada',
  authorName: 'Ada',
  authorColor: '#123456',
  mentions,
});

describe('mentionedByOf (Work Tracker 1036)', () => {
  it('keeps who mentioned someone when they reply after', () => {
    const comments: C[] = [
      ada(1, [{ userId: 'user_bea' }]),
      { createdAt: 2, authorId: 'user_bea', authorName: 'Bea', mentions: [] },
    ];
    expect(mentionedByOf(comments, mentionIdsOf)).toEqual({
      user_bea: { id: 'user_ada', name: 'Ada', color: '#123456' },
    });
  });

  it('keeps who mentioned someone when a third person replies after', () => {
    const comments: C[] = [
      ada(1, [{ userId: 'user_bea' }]),
      { createdAt: 2, authorId: 'user_cy', authorName: 'Cy' },
    ];
    expect(mentionedByOf(comments, mentionIdsOf)?.user_bea?.name).toBe('Ada');
  });

  it('names the latest to mention them, in any order, by user and member id', () => {
    const comments: C[] = [
      { createdAt: 5, authorName: 'Cy', mentions: [{ userId: 'user_bea', memberId: 'm_bea' }] },
      ada(1, [{ userId: 'user_bea' }]),
      ada(3, [{ userId: null, memberId: 'm_bea' }]),
    ];
    expect(mentionedByOf(comments, mentionIdsOf)).toEqual({
      user_bea: { id: null, name: 'Cy' },
      m_bea: { id: null, name: 'Cy' },
    });
  });

  it('names no one for a self-mention, and nothing when nobody else is mentioned', () => {
    expect(mentionedByOf([ada(1, [{ userId: 'user_ada' }]), ada(2)], mentionIdsOf)).toBeUndefined();
    expect(mentionedByOf<C>([{ createdAt: 1, authorName: 'X' }], mentionIdsOf)).toBeUndefined();
  });

  it('spreads into a row only when there is one', () => {
    expect(withMentionedBy(undefined)).toEqual({});
    const by = { user_bea: { id: 'user_ada', name: 'Ada' } };
    expect(withMentionedBy(by)).toEqual({ mentionedBy: by });
  });
});
