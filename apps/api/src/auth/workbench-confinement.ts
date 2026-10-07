// The choke point's verdict on a workbench session (docs/specs/013-workspace/blueprints/workbench-embeds.md
// "A request bearing lvw_", steps 3 to 5): ambient credentials refused beside it, the allow-list, then the
// session's level. Null lets the request through to its route, which re-gates with the owner's identity.

import { apiRouteLabel, workbenchRouteVerdict } from '@livediagram/api-schema';
import { forbidden, notFound } from '../responses';
import type { WorkbenchContext } from '../routes/context';
import { sessionPrefixOf } from './workbench-session';

// Headers that would lend a session someone else's access: a share code, a guest id, a share password.
const AMBIENT_HEADERS = ['X-Share-Code', 'X-Owner-Id', 'X-Share-Password'] as const;

const WRITE_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

// A view session may still join the room and end itself (WB9).
function isViewExempt(method: string, segments: readonly string[]): boolean {
  const path = segments.slice(1).join('/');
  if (method === 'DELETE' && path === 'workbench/sessions/current') return true;
  return method === 'POST' && segments[1] === 'documents' && segments[3] === 'room-ticket';
}

export function workbenchRefusal(
  workbench: WorkbenchContext,
  method: string,
  segments: readonly string[],
  headers: Headers,
): Response | null {
  const sessionPrefix = sessionPrefixOf(workbench.sessionId);
  const route = apiRouteLabel(method, `/${segments.join('/')}`);
  if (AMBIENT_HEADERS.some((name) => headers.has(name))) {
    console.warn('[workbench] confined', { method, route, sessionPrefix });
    return forbidden('workbench_confined');
  }
  const verdict = workbenchRouteVerdict(method, segments, workbench);
  if (verdict === 'other-document') return notFound();
  if (verdict === 'confined') {
    console.warn('[workbench] confined', { method, route, sessionPrefix });
    return forbidden('workbench_confined');
  }
  if (workbench.level === 'view' && WRITE_METHODS.has(method) && !isViewExempt(method, segments)) {
    console.warn('[workbench] read-only-refused', { method, route, sessionPrefix });
    return forbidden('workbench_read_only');
  }
  return null;
}
