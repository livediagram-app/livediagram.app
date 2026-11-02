// livehuddle's Community categories (docs/specs/025-community/community.md "Categories"): its own closed set from
// the shared contract, where every app keeps its own (liveworkspace/docs/specs/007-community/community.md).

import { communityCategories, communityCategoryTypes } from '@liveworkspace/community';

// livehuddle's app on the shared Community service (registered by its "Adding an app" steps).
export const COMMUNITY_APP = 'livehuddle.app' as const;

export const COMMUNITY_CATEGORIES = communityCategories(COMMUNITY_APP);

// Each category's telemetry type (`Community·Shared|Changed·<Type>`), as a list.
export const COMMUNITY_CATEGORY_TYPES: readonly string[] = communityCategoryTypes(COMMUNITY_APP);
