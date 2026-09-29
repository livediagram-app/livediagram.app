import { describe, expect, it } from 'vitest';
import {
  assignHandles,
  mentionHandle,
  mentionSegments,
  mentionsInText,
  sanitizeMentions,
  textMentions,
  type CommentMention,
} from './comment-mentions';

// docs/specs/012-collaboration/comment-mentions.md

const tom: CommentMention = {
  userId: 'u1',
  memberId: 'm1',
  name: 'Thomas McClean',
  handle: 'thomas-mcclean',
};

describe('mentionHandle', () => {
  it('kebab-cases a name and folds accents', () => {
    expect(mentionHandle('Thomas McClean')).toBe('thomas-mcclean');
    expect(mentionHandle('  Zoë  O’Brien ')).toBe('zoe-o-brien');
    expect(mentionHandle('!!!')).toBe('');
  });
});

describe('assignHandles', () => {
  it('suffixes duplicates in list order and falls back to the email', () => {
    const out = assignHandles([
      { name: 'Sam Lee' },
      { name: 'Sam Lee' },
      { name: '', email: 'priya.k@example.com' },
      { name: '' },
    ]);
    expect(out.map((p) => p.handle)).toEqual(['sam-lee', 'sam-lee-2', 'priya-k', 'teammate']);
  });
});

describe('textMentions', () => {
  it('matches a whole @handle token only', () => {
    expect(textMentions('hey @thomas-mcclean!', 'thomas-mcclean')).toBe(true);
    expect(textMentions('@thomas-mcclean-2 hi', 'thomas-mcclean')).toBe(false);
    expect(textMentions('mail me@thomas-mcclean', 'thomas-mcclean')).toBe(false);
    expect(textMentions('no mention', 'thomas-mcclean')).toBe(false);
  });
});

describe('mentionsInText', () => {
  it('keeps only mentions still in the text, once each', () => {
    const sam = { ...tom, userId: 'u2', memberId: 'm2', handle: 'sam' };
    expect(mentionsInText('@thomas-mcclean and @thomas-mcclean', [tom, tom, sam])).toEqual([tom]);
  });
});

describe('sanitizeMentions', () => {
  it('keeps well-formed entries and drops the rest', () => {
    expect(
      sanitizeMentions([
        tom,
        { userId: null, memberId: 'm9', name: 'Invited', handle: 'invited' },
        { userId: null, name: 'No key', handle: 'x' },
        { userId: 'u', name: 'x'.repeat(101), handle: 'x' },
        'junk',
      ]),
    ).toEqual([tom, { userId: null, memberId: 'm9', name: 'Invited', handle: 'invited' }]);
    expect(sanitizeMentions('nope')).toBeUndefined();
    expect(sanitizeMentions([])).toBeUndefined();
  });

  it('caps the list at 20', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...tom,
      userId: `u${i}`,
      handle: `h${i}`,
    }));
    expect(sanitizeMentions(many)).toHaveLength(20);
  });
});

describe('mentionSegments', () => {
  it('splits matching handles out as mention runs', () => {
    expect(mentionSegments('hi @thomas-mcclean, and @nobody', [tom])).toEqual([
      { text: 'hi ' },
      { text: '@thomas-mcclean', mention: tom },
      { text: ', and @nobody' },
    ]);
    expect(mentionSegments('plain', undefined)).toEqual([{ text: 'plain' }]);
  });
});
