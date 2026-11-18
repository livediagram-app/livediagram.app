import type { ForumReply, ForumTopic } from './forum';
import type { CommunityPost } from './post';

// Test-only fixtures (`@liveworkspace/community/testing`), shared by every suite that draws a Community post, so
// each test states only the fields it relies on. Never imported by app code.

// A listed, named post with plausible values; `patch` sets what the test asserts on.
export function communityPostFixture(patch: Partial<CommunityPost> = {}): CommunityPost {
  return {
    id: 'post1',
    app: 'livediagram.app',
    title: 'Payments Platform',
    description: 'How our payment services talk to each other.',
    category: 'software',
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

// A listed Forum topic and a listed reply under it, with plausible values.
const noReactions = { counts: { helpful: 0, thanks: 0, celebrate: 0 }, mine: [] };

export function forumTopicFixture(patch: Partial<ForumTopic> = {}): ForumTopic {
  return {
    id: 't1',
    topicId: null,
    category: 'question',
    app: 'livediagram.app',
    title: 'How do I connect two shapes?',
    body: 'I drew two boxes and want an arrow between them. What is the quickest way?',
    author: { name: 'Ada', color: '#2563eb' },
    createdAt: Date.UTC(2026, 10, 1),
    editedAt: null,
    state: 'listed',
    own: false,
    reactions: noReactions,
    answerId: null,
    ...patch,
  };
}

export function forumReplyFixture(patch: Partial<ForumReply> = {}): ForumReply {
  return {
    id: 'r1',
    topicId: 't1',
    body: 'Drag from the dot on the edge of a shape to the other one.',
    author: { name: 'Bea', color: '#7c3aed' },
    createdAt: Date.UTC(2026, 10, 2),
    editedAt: null,
    state: 'listed',
    own: false,
    reactions: noReactions,
    ...patch,
  };
}
