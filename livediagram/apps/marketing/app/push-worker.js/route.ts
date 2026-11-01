import { pushWorkerResponse } from '@liveworkspace/marketing-site/lib/install';

// The push-only service worker at /push-worker.js (docs/specs/016-platform/installable-app.md): shows phone
// notifications and opens their links, with no fetch handler. Its scope is the whole address, so it serves the editor
// and the Explorer too. Built once, at export.
export const dynamic = 'force-static';

export function GET(): Response {
  return pushWorkerResponse('/livediagram-icon-256.png');
}
