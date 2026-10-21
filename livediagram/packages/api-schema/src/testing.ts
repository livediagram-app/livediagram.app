import type { CommunityPost } from './community';

// Test-only fixtures (`@livediagram/api-schema/testing`), shared by every suite that draws a Community post, so
// each test states only the fields it relies on. Never imported by app code.

// A listed, named post with plausible values; `patch` sets what the test asserts on.
export function communityPostFixture(patch: Partial<CommunityPost> = {}): CommunityPost {
  return {
    id: 'post1',
    title: 'Payments Platform',
    description: 'How our payment services talk to each other.',
    category: 'architecture',
    tags: [],
    likeCount: 0,
    copyCount: 0,
    publishedAt: 1,
    updatedAt: 1,
    shareCode: 'CODE1',
    author: { name: 'Ada', color: '#f97316', picture: null },
    anonymous: false,
    liked: false,
    ...patch,
  };
}
