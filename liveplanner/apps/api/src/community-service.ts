// liveplanner's side of the liveworkspace Community service (liveworkspace/docs/specs/007-community/community.md;
// docs/specs/025-community/community.md): the shared app client (@liveworkspace/community/app) bound to this app.
// The posts, likes, copies and reports live there; each plan keeps its own post's link (plan-room/community-post.ts)
// and tells the service what only it knows: who may publish, where the plan stands, and who copied it. Without
// COMMUNITY_KEY this deploy has no Community, and nothing here calls out.

import { communityAppClient } from '@liveworkspace/community/app';

export {
  communityEnabled,
  communityOn,
  communityServiceConfigured,
} from '@liveworkspace/community/app';

export const COMMUNITY_APP = 'liveplanner.app';

export const communityService = communityAppClient(COMMUNITY_APP);
