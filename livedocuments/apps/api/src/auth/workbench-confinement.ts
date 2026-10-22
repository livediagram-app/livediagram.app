// The choke point's verdict on a workbench session (docs/specs/013-workspace/blueprints/workbench-embeds.md
// "A request bearing lvw_", steps 3 to 5, and "The choke point by scope"): ambient credentials refused beside it
// (by scope), the allow-list of its scope, then the session's level. Null lets the request through to its route,
// which re-gates with the owner's identity.

import {
  apiRouteLabel,
  workbenchAmbientHeaders,
  workbenchRouteVerdict,
} from '@livedocuments/api-schema';
import { forbidden, notFound } from '../responses';
import type { WorkbenchContext } from '../routes/context';
import { sessionPrefixOf } from './workbench-session';

const WRITE_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

// A view session may still join the room and end itself (WB9).
function isViewExempt(method: string, segments: readonly string[]): boolean {
  const path = segments.slice(1).join('/');
  if (method === 'DELETE' && path === 'workbench/sessions/current') return true;
  return method === 'POST' && segments[1] === 'documents' && segments[3] === 'room-ticket';
}

// The share-link list carries every code, edit links included: a view session never reads it (WB54).
const isShareLinkList = (method: string, segments: readonly string[]) =>
  method === 'GET' &&
  segments.length === 4 &&
  segments[1] === 'documents' &&
  segments[3] === 'share';

export function workbenchRefusal(
  workbench: WorkbenchContext,
  method: string,
  segments: readonly string[],
  headers: Headers,
): Response | null {
  const sessionPrefix = sessionPrefixOf(workbench.sessionId);
  const { scope } = workbench;
  const route = apiRouteLabel(method, `/${segments.join('/')}`);
  if (workbenchAmbientHeaders(scope).some((name) => headers.has(name))) {
    console.warn('[workbench] confined', { scope, method, route, sessionPrefix });
    return forbidden('workbench_confined');
  }
  const verdict = workbenchRouteVerdict(method, segments, workbench);
  if (verdict === 'other-document') return notFound();
  if (verdict === 'confined') {
    console.warn('[workbench] confined', { scope, method, route, sessionPrefix });
    return forbidden('workbench_confined');
  }
  const readOnlyRefused =
    (WRITE_METHODS.has(method) && !isViewExempt(method, segments)) ||
    isShareLinkList(method, segments);
  if (workbench.level === 'view' && readOnlyRefused) {
    console.warn('[workbench] read-only-refused', { scope, method, route, sessionPrefix });
    return forbidden('workbench_read_only');
  }
  return null;
}
