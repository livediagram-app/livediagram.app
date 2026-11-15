// Who the Export dialog offers Whole Plan to (docs/specs/026-plan/plan-tabs.md "Whole Plan"): an Editor of the whole
// plan (`isStructureReadOnly` is a Participant's, a Viewer's and a tab-scoped link's), on a plan saved to an account (a
// This Browser plan has no server copy to write the file from). The api checks the same on its door. Pure.
export function wholePlanOffer(opts: {
  projectId: string | null;
  ownerId: string;
  isOffline: boolean;
  isStructureReadOnly: boolean;
}): { projectId: string; ownerId: string } | undefined {
  if (!opts.projectId || opts.isOffline || opts.isStructureReadOnly) return undefined;
  return { projectId: opts.projectId, ownerId: opts.ownerId };
}
