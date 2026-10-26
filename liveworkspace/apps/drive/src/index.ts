// liveworkspace's Google Drive mirror (liveworkspace/docs/specs/005-drive/drive.md): one Worker on liveworkspace.app/api/drive (and
// each app's /api/drive through its router), and a Durable Object per connected person that keeps their own work,
// from every app, copied to their Google Drive. The browser's routes are routes.ts; Google's push and the index's and
// accounts' calls are app-routes.ts; the mirror itself is mirror/.

import { handle, routeDeps } from './dispatch';
import type { Env } from './env';

export { DriveMirror } from './mirror/durable-object';

const worker = {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handle(request, env, routeDeps(env, ctx));
  },
};

export default worker;
