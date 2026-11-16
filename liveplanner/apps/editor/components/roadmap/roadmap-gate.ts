// Who sees Publish as Roadmap (docs/specs/026-plan/public-roadmap.md "Who may publish"): the plan's owner or a team
// member (no share link, no tab), on a plan saved to the server, outside an embed and a workbench frame. A guest owner
// may publish, so signing in is not asked. A share-link holder at any level and a plan in This Browser see no row; the
// api refuses them all the same (403 `roadmap_needs_owner`), so this is presentation, never the rule. Pure.

export type RoadmapScope = { ownerId: string; projectId: string };

type GateInput = {
  hydrated: boolean;
  embed: boolean;
  workbench: boolean;
  // A plan saved only in this browser: no server to answer the page.
  offline: boolean;
  // The items scope: whose plan, and the share link and tab the session holds it through.
  scope: {
    ownerId: string;
    projectId: string;
    shareCode: string | null;
    tabId: string | null;
  } | null;
};

export function roadmapScopeFor(input: GateInput): RoadmapScope | null {
  const { scope } = input;
  if (!scope || !input.hydrated || input.embed || input.workbench || input.offline) return null;
  // The owner's and a team member's sessions carry no share code and reach every tab.
  if (scope.shareCode !== null || scope.tabId !== null) return null;
  return { ownerId: scope.ownerId, projectId: scope.projectId };
}

/** The ids of the Plan boards on a tab, in its order: what Publish as Roadmap offers. */
export function boardIdsOnTab(
  elements: readonly { id: string; type?: string; shape?: string }[],
): string[] {
  return elements
    .filter((el) => el.type === 'shape' && el.shape === 'plan-board')
    .map((el) => el.id);
}
