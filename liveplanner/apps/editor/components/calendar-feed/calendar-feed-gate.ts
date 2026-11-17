// Who sees Subscribe to Calendar (docs/specs/026-plan/calendar-feed.md "Where it lives"): signed in, on a plan saved
// to an account, holding it as its owner or a team member (no share link, no tab), and not in an embed or a workbench
// frame. A share-link holder at any level, a guest and a plan in This Browser see no row; the api refuses them all the
// same (403 `calendar_feed_needs_member`), so this is presentation, never the rule. Pure.

export type CalendarFeedScope = { ownerId: string; projectId: string };

type GateInput = {
  hydrated: boolean;
  embed: boolean;
  workbench: boolean;
  // A plan saved only in this browser: no server to keep a feed.
  offline: boolean;
  signedIn: boolean;
  // The items scope: whose plan, and the share link and tab the session holds it through.
  scope: {
    ownerId: string;
    projectId: string;
    shareCode: string | null;
    tabId: string | null;
  } | null;
};

export function calendarFeedScopeFor(input: GateInput): CalendarFeedScope | null {
  const { scope } = input;
  if (!scope || !input.hydrated || input.embed || input.workbench) return null;
  if (input.offline || !input.signedIn) return null;
  // The owner's and a team member's sessions carry no share code and reach every tab.
  if (scope.shareCode !== null || scope.tabId !== null) return null;
  return { ownerId: scope.ownerId, projectId: scope.projectId };
}

/** What stands before the feed for someone who would have one but for where the plan lives or who they are
 *  (liveworkspace/docs/specs/004-index/footer-tools-menu.md "Always there"): Sign In for a guest (once sign-in has
 *  answered), then Sync Plan on a plan in This Browser; null for a share-link holder or a tab-scoped link, who signing
 *  in or syncing would not help, and for anyone who already has the feed. */
export function calendarFeedGateFor(
  input: GateInput & { authLoaded: boolean },
): 'sync' | 'sign_in' | null {
  const { scope } = input;
  if (!input.hydrated || input.embed || input.workbench) return null;
  if (scope && (scope.shareCode !== null || scope.tabId !== null)) return null;
  if (!scope && !input.offline) return null;
  if (!input.signedIn) return input.authLoaded ? 'sign_in' : null;
  return input.offline ? 'sync' : null;
}

// The query that opens Subscribe to Calendar on arrival: where a guest's sign-in comes back to.
export const CALENDAR_FEED_PARAM = 'calendar';
