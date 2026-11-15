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
