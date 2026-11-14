// /api/community/mine: My Shares (docs/specs/025-community/community.md "My Shares"), @liveworkspace/community/app's
// route (mine-route.ts, where the rules are written) bound to this app's service client and answers.

import { communityAppClient, createCommunityMineRoute } from '@liveworkspace/community/app';
import { COMMUNITY_APP } from '../community-service';
import { json, notFound, signInRequired } from '../responses';

export const handleCommunity = createCommunityMineRoute({
  service: communityAppClient(COMMUNITY_APP),
  responses: { json, notFound, signInRequired },
});
