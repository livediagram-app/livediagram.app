// A plan's Community post as the plan keeps it (docs/specs/025-community/community.md "Viewing a post's plan";
// liveworkspace/docs/specs/007-community/community.md "Keeping in step"): every app's room keeps its post the same
// way (@liveworkspace/community/app post.ts); this binds it to the plan's own SQLite, the index as the post's author
// and liveplanner's participants. At most one row (plan-schema.ts `community_post`).

import {
  checkCommunityPost as checkPost,
  communityPostAuthor as postAuthor,
  leaveCommunity as leavePost,
  ownerCommunityState,
  readCommunityPost as readPost,
  type CommunityIndex,
  type CommunityPost,
} from '@liveworkspace/community/app';
import type { CommunityAuthor } from '@liveplanner/api-schema';
import { communityService } from '../community-service';
import { indexFor } from '../index-service';
import { getParticipant } from '../person/profiles';
import type { Env, PlanEnv } from '../types';
import type { PlanMeta } from './plan-content';

export {
  COMMUNITY_CHECK_MS,
  communityCheckDueAt,
  openCommunityCode,
  type CommunityPost,
} from '@liveworkspace/community/app';

export const readCommunityPost = (env: PlanEnv) => readPost(env.PLAN_DB);

// The post's state for the owner's read of the plan (the header badge), null with no post.
export const readOwnerCommunityState = (env: PlanEnv) => ownerCommunityState(env.PLAN_DB);

// Who a post shows on its link's doors: "Anonymous" when the author chose it, else their display identity.
export const communityPostAuthor = (env: Env, post: CommunityPost): Promise<CommunityAuthor> =>
  postAuthor(post, (personId) => getParticipant(env, personId));

// The index as the post's author, in the plan's team when it has one.
export const communityIndexAs =
  (env: Env) =>
  (authorId: string, teamId: string | null): CommunityIndex | null =>
    indexFor(env, { kind: 'delegate', personId: authorId, teams: teamId ? [teamId] : [] });

// Ask the index where the post's plan stands and the service whether it hid the post; send the service what
// changed. Answers the post as it now is (null once it is gone). Throws when either cannot be reached.
export const checkCommunityPost = (
  env: PlanEnv,
  planId: string,
  meta: PlanMeta | null,
  now: number,
): Promise<CommunityPost | null> =>
  checkPost({
    env,
    db: env.PLAN_DB,
    service: communityService,
    documentId: planId,
    meta,
    indexAs: communityIndexAs(env),
    now,
  });

// The sheets the plan's forms send their responses to (a Form tab's `form.sheet.sheetId`), read from the tabs' stored
// bodies by SQLite's JSON functions, so no body is parsed here. A Community visitor sees a response sheet's heading
// row alone (community-redact.ts redactSheetForCommunity).
export async function readResponseSheetIds(env: PlanEnv, planId: string): Promise<Set<string>> {
  const rows = await env.PLAN_DB.prepare(
    `SELECT sheet_id FROM (
       SELECT CASE WHEN json_valid(t.data) THEN json_extract(t.data, '$.form.sheet.sheetId') END AS sheet_id
         FROM plan_tabs dt JOIN tabs t ON t.id = dt.tab_id
        WHERE dt.plan_id = ?
     ) WHERE typeof(sheet_id) = 'text'`,
  )
    .bind(planId)
    .all<{ sheet_id: string }>();
  return new Set((rows.results ?? []).map((r) => r.sheet_id));
}

// A plan going for good takes its post with it: the service hears it is gone. Best effort.
export const leaveCommunity = (env: PlanEnv, planId: string): Promise<void> =>
  leavePost(env, env.PLAN_DB, communityService, planId);
