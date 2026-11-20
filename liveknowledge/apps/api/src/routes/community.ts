// /api/community/mine: My Shares (docs/specs/025-community/community.md "My Shares"), @liveworkspace/community/app's
// route (mine-route.ts, where the rules are written) bound to this app's service client and answers.

import { createCommunityMineRoute } from '@liveworkspace/community/app';
import { communityService } from '../community-service';
import { json, notFound, signInRequired } from '../responses';

export const handleCommunity = createCommunityMineRoute({
  service: communityService,
  responses: { json, notFound, signInRequired },
});
