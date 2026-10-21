// Who a Community post is credited to (docs/specs/025-community/community.md "Posts"): the author shape and the two
// stand-ins. Kept apart from the rest of the Community vocabulary so a caller that only shows an author (the
// editor's share client) does not load the categories, limits and validation with it.

export type CommunityAuthor = { name: string; color: string; picture: string | null };

// The author shown on an anonymous post.
export const COMMUNITY_ANONYMOUS_AUTHOR: CommunityAuthor = {
  name: 'Anonymous',
  color: '#64748b',
  picture: null,
};

// The author shown when a post's author has no participant row (blueprint §6).
export const COMMUNITY_UNKNOWN_AUTHOR: CommunityAuthor = {
  name: 'Someone',
  color: '#64748b',
  picture: null,
};
