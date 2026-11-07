// Start With's Community tiles (liveworkspace/docs/specs/007-community/community.md "Start With"): the one read, the
// hook a template picker calls, the cards it draws beside its templates, placed in its groups and search, and their
// badge's colours.
export {
  fetchCommunityStart,
  communityStartInHand,
  resetCommunityStartForTests,
  type CommunityStartPosts,
  type CommunityStartSource,
} from './start-client';
export { useCommunityStart } from './useCommunityStart';
export {
  COMMUNITY_START_BADGE,
  CommunityStartPicture,
  communityStartCard,
  communityStartCardId,
  communityStartCredit,
  communityStartHref,
  communityStartMatches,
  communityStartPostId,
  communityStartPostsIn,
  findCommunityStartPost,
  type CommunityStartCard,
} from './start-cards';
export {
  CommunityStartCreditNote,
  communityStartCardsIn,
  communityStartCreditNote,
  communityStartPostsInto,
  communityStartTile,
  withCommunityStartMatches,
  type CommunityStartPostsFor,
  type CommunityStartSearchGroup,
  type CommunityStartTile,
  type CommunityStartTileOptions,
} from './start-tiles';
export { COMMUNITY_START_BADGE_TINT, communityStartBadgeStyle } from './start-badge';
