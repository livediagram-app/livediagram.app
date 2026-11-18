// The Worker's settings. They live apart from src/index.ts because a Worker's entry module may only
// export handlers: the runtime refuses to start on any other export there.

import { COMMUNITY_API_PATH } from '@liveworkspace/community';

// The path of liveworkspace.app this Worker owns: its API, under /api like every liveworkspace API.
export const API_PATH = COMMUNITY_API_PATH;

// How long a public answer may be kept, by a browser and at Cloudflare's edge (liveworkspace/docs/specs/007-community/community.md
// "Public routes"). A post hidden after reports lingers no longer than this.
export const LIST_MAX_AGE_S = 30;
// Every home page visit asks for the featured six, so the edge answers them for a minute.
export const FEATURED_MAX_AGE_S = 60;
// Crawlers read the sitemap a few times a day at most.
export const SITEMAP_MAX_AGE_S = 3600;

// The largest body any route takes: a post's input with its author, or a sync of COMMUNITY_SYNC_MAX
// documents.
export const MAX_BODY_BYTES = 64 * 1024;

// The sweep (community.md "The sweep"): a post is checked again once its last check is this old, and an app's door
// has this long to answer before that app waits for the next run.
export const COMMUNITY_SWEEP_EVERY_MS = 10 * 60_000;
export const COMMUNITY_SWEEP_TIMEOUT_MS = 10_000;

// The Forum's check (community.md "The Forum", "The check"): Workers AI's content safety model, how long it may take,
// how many checks a UTC day may make in all, and the cron's retry of posts waiting as Pending.
export const FORUM_CHECK_MODEL = '@cf/meta/llama-guard-3-8b';
export const FORUM_CHECK_TIMEOUT_MS = 10_000;
export const FORUM_CHECKS_PER_DAY = 500;
export const FORUM_RETRY_BATCH = 10;
// Just under the cron's five minutes, so each run asks again for what the last could not answer.
export const FORUM_RETRY_EVERY_MS = 4 * 60_000;

// What the check costs, from Workers AI's price list for FORUM_CHECK_MODEL (community.md "The check"): Neurons per
// million tokens, input and output. The binding reports tokens, never Neurons, so a check's cost is worked out here.
export const FORUM_NEURONS_PER_M_INPUT = 44_003;
export const FORUM_NEURONS_PER_M_OUTPUT = 2_730;
// The Neurons the check may use in a UTC day: 80% of the free 10,000, so the account's other Workers AI (liveplanner's
// Automations) keep the rest. Past it new posts wait as Pending, as past FORUM_CHECKS_PER_DAY.
export const FORUM_NEURONS_PER_DAY = 8_000;
// What the dashboard's read of the tally covers, and how long an answer may be kept.
export const CHECKS_DAYS = 30;
export const CHECKS_MAX_AGE_S = 300;
// The counter subjects the check's daily tally lives under (src/forum/tally.ts).
export const FORUM_TALLY_PREFIX = 'chk:';
// How long the check's daily tallies are kept for the dashboard (every other counter is dropped after two days).
export const FORUM_CHECK_TALLY_KEEP_DAYS = 90;
// Reports older than this are pruned by the cron (community.md "The check", Reports). A post three reports hid stays
// hidden: the state is on the post, not counted again from its reports.
export const FORUM_REPORTS_KEEP_MS = 90 * 24 * 60 * 60 * 1000;
