// The Worker's settings. They live apart from src/index.ts because a Worker's entry module may only
// export handlers: the runtime refuses to start on any other export there.

import { COMMUNITY_API_PATH } from '@liveworkspace/community';

// The path of liveworkspace.app this Worker owns: its API, under /api like every liveworkspace API.
export const API_PATH = COMMUNITY_API_PATH;

// How long a public answer may be kept, by a browser and at Cloudflare's edge (liveworkspace/docs/community.md
// "Caching"). A post hidden after reports lingers no longer than this.
export const LIST_MAX_AGE_S = 30;
// Every home page visit asks for the featured six, so the edge answers them for a minute.
export const FEATURED_MAX_AGE_S = 60;
// Crawlers read the sitemap a few times a day at most.
export const SITEMAP_MAX_AGE_S = 3600;

// The largest body any route takes: a post's input with its author, or a sync of COMMUNITY_SYNC_MAX
// documents.
export const MAX_BODY_BYTES = 64 * 1024;
