import { pushWorkerResponse } from '@liveworkspace/marketing-site/lib/install';

// liveworkspace.app's push-only service worker at /push-worker.js (site.md "Installing"): shows phone notifications
// and opens their links, with no fetch handler. Built once, at export.
export const dynamic = 'force-static';

export function GET(): Response {
  return pushWorkerResponse('/liveworkspace-icon-256.png');
}
