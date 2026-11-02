// livehuddle's Community categories (docs/specs/025-community/community.md "Categories"): its own closed set from
// the shared contract, where every app keeps its own (liveworkspace/docs/specs/007-community/community.md).

import { communityCategories, communityCategoryTypes } from '@liveworkspace/community';

// The shared contract registers no Community for livehuddle (its v1 ships none, open decision D3), so the fork
// borrows livediagram's categories until the cut that removes the community app (build plan step 5.3).
export const COMMUNITY_APP = 'livediagram.app' as const;

export const COMMUNITY_CATEGORIES = communityCategories(COMMUNITY_APP);

// Each category's telemetry type (`Community·Shared|Changed·<Type>`), as a list.
export const COMMUNITY_CATEGORY_TYPES: readonly string[] = communityCategoryTypes(COMMUNITY_APP);
