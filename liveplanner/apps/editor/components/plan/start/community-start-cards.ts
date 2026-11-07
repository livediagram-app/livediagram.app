// Start With's Community tiles in Start Planning (docs/specs/026-plan/plan-mode.md "From the Community";
// liveworkspace/docs/specs/007-community/community.md "Start With"). Start Planning's rail is kinds of start (Boards,
// Spreadsheets, ...), not the template categories the Community files posts under, so every category's tiles join
// Inspiration, where the Plan templates those categories sort are: the Community's own order of categories, each
// category's best first. The tiles, their placing in the groups and search, their read and their look are the shared
// @liveworkspace/community-ui/start; this only says where they go.
import { COMMUNITY_CATEGORIES, communityImagePath } from '@liveplanner/api-schema';
import {
  communityStartCreditNote,
  communityStartPostsInto,
  type CommunityStartTileOptions,
} from '@liveworkspace/community-ui/start';
import { API_BASE } from '@/lib/api-client';
import type { PlanPalette } from '../plan-palette';

/** The rail category the tiles join. */
export const COMMUNITY_START_GROUP = 'inspiration';

const postsFor = communityStartPostsInto(
  COMMUNITY_START_GROUP,
  COMMUNITY_CATEGORIES.map((c) => c.id),
);

// A post's live card image: this app's api's, since the plan is this app's (the router hands the door to
// liveworkspace's previews).
const imageUrl = (shareCode: string) => `${API_BASE}${communityImagePath(shareCode)}`;

/** How Start Planning draws the tiles: all in Inspiration, the credit in the panel's muted ink. */
export const communityStartTiles = (palette: PlanPalette): CommunityStartTileOptions => ({
  imageUrl,
  note: communityStartCreditNote(palette.muted),
  postsFor,
});
