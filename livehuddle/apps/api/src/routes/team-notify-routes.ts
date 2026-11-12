// /api/teams/<id>/access-check, /notify-action and /notify-mention: the assigned-actions and mentions endpoints
// livehuddle once had. It has no comments, mentions or assigned actions now
// (docs/specs/002-project-scope/not-in-livehuddle.md "Comments, actions, links and notes"), so no mention or
// action-assigned email goes: all three answer 410 `gone` to every caller, an older client's included.

import { json } from '../responses';
import type { RouteContext } from './context';

const GONE_ROUTES: ReadonlySet<string> = new Set([
  'access-check',
  'notify-action',
  'notify-mention',
]);

// Returns null when the request isn't one of these routes.
export function handleTeamNotifyRoutes(ctx: RouteContext): Response | null {
  const route = ctx.segments.length === 4 ? ctx.segments[3] : null;
  if (!route || !GONE_ROUTES.has(route)) return null;
  console.info('[team-notify] gone', { route });
  return json(
    { error: 'gone', message: 'livehuddle has no assigned actions or mentions' },
    { status: 410 },
  );
}
