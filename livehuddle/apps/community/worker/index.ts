// The Community worker's script (docs/specs/025-community/community.md "Search engines"): every app's Community
// Worker (@liveworkspace/community-site/worker), bound to livehuddle. It runs first for only two paths (the
// `run_worker_first` list in wrangler.toml): a post's page, its <head> naming the post, and the sitemap of every public
// post, both from the liveworkspace Community service.
//
// The entry module exports only the handler: the runtime reads every named value export as an entrypoint and refuses
// to start on anything else.

import { SITE_URL } from '@livehuddle/ui/site';
import { createCommunityWorker } from '@liveworkspace/community-site/worker';

export type { CommunityWorkerEnv as Env } from '@liveworkspace/community-site/worker';

export default createCommunityWorker({
  // Borrowed from livediagram until the community app is cut (@livehuddle/api-schema COMMUNITY_APP; kept a literal so
  // the Worker doesn't bundle the schema).
  app: 'livediagram.app',
  siteUrl: SITE_URL,
  product: 'livehuddle',
});
