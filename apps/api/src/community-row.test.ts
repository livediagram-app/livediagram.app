import { describe, expect, it } from 'vitest';
import { COMMUNITY_ANONYMOUS_AUTHOR } from '@livediagram/api-schema';
import {
  communitySearchText,
  likePattern,
  parseTags,
  rowAuthor,
  rowState,
  rowToCommunityPost,
  type CommunityPostRow,
} from './community-row';

// From a community_posts row to what the public sees (docs/specs/025-community/community.md "What a post shows").

const row = (over: Partial<CommunityPostRow> = {}): CommunityPostRow => ({
  id: 'post1',
  document_id: 'doc-secret',
  share_code: 'CODE1',
  author_id: 'user_secret',
  title: 'Payments',
  description: 'How payments flow.',
  category: 'architecture',
  tags: '["aws","ux"]',
  like_count: 3,
  copy_count: 1,
  state: 'listed',
  hidden_by: null,
  published_at: 10,
  updated_at: 20,
  anonymous: 0,
  author_name: 'Ada',
  author_color: '#f97316',
  author_picture: null,
  ...over,
});

describe('rowToCommunityPost', () => {
  it('never carries the author id or the document id', () => {
    const post = rowToCommunityPost(row(), true);
    expect(post).toEqual({
      id: 'post1',
      title: 'Payments',
      description: 'How payments flow.',
      category: 'architecture',
      tags: ['aws', 'ux'],
      likeCount: 3,
      copyCount: 1,
      publishedAt: 10,
      updatedAt: 20,
      shareCode: 'CODE1',
      author: { name: 'Ada', color: '#f97316', picture: null },
      anonymous: false,
      liked: true,
    });
    expect(JSON.stringify(post)).not.toMatch(/user_secret|doc-secret/);
  });

  it('reads an unknown category as Something Else and bad tags as none', () => {
    const post = rowToCommunityPost(row({ category: 'gone', tags: 'not json' }), false);
    expect(post.category).toBe('other');
    expect(post.tags).toEqual([]);
    expect(parseTags('[1, "a", null]')).toEqual(['a']);
    expect(parseTags('{"a":1}')).toEqual([]);
  });
});

describe('rowAuthor', () => {
  it('is Anonymous for an anonymous post, whatever the participant row says', () => {
    expect(rowAuthor(row({ anonymous: 1, author_picture: 'https://img.clerk.com/a.png' }))).toEqual(
      COMMUNITY_ANONYMOUS_AUTHOR,
    );
  });

  it('falls back to a neutral author when the participant row is gone, and to a default colour', () => {
    expect(rowAuthor(row({ author_name: null })).name).not.toBe('');
    expect(rowAuthor(row({ author_color: null })).color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('the small helpers', () => {
  it('state, search text and LIKE patterns', () => {
    expect(rowState(row({ state: 'hidden' }))).toBe('hidden');
    expect(rowState(row({ state: 'odd' }))).toBe('listed');
    expect(communitySearchText('Title', 'Desc', ['AWS', 'ux'])).toBe('title\ndesc\naws ux');
    expect(likePattern('50%_off\\')).toBe('%50\\%\\_off\\\\%');
  });
});
