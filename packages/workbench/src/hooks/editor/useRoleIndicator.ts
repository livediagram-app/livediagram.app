// What the role pill shows (docs/specs/007-editor/editor-app.md#role-pill): the role in force (view preview
// included), the owner it discloses, and the toggle when the session's role allows editing. Each editor binds it
// once, at module scope in its `useRoleIndicator.ts`, to its editor context and owner badge (lib/presence-rows).

type RoleContext<Role> = {
  isOwner: boolean;
  // The level in force (docs/specs/013-workspace/share-roles.md), the view preview included.
  can: { level: Role };
  canToggleRole: boolean;
  toggleViewPreview: () => void;
};

export function createUseRoleIndicator<Role, Ctx extends RoleContext<Role>>(deps: {
  useEditorContext: () => Ctx;
  // Who the pill discloses as the owner, read off the same context.
  resolveOwnerBadge: (ctx: Ctx) => { name: string } | null;
  // The team that owns a team canvas (its name, or null where the session does not know it); null on a personal
  // document. Optional: an editor without team canvases leaves it out. It changes only the words, never `isSelf` or
  // who gets the toggle.
  resolveOwnerTeam?: (ctx: Ctx) => { name: string | null } | null;
}) {
  return function useRoleIndicator(): {
    role: Role;
    ownerName: string | null;
    isSelf: boolean;
    team: { name: string | null } | null;
    onToggle?: () => void;
  } {
    const ctx = deps.useEditorContext();
    const owner = deps.resolveOwnerBadge(ctx);
    return {
      role: ctx.can.level,
      ownerName: owner?.name ?? null,
      isSelf: ctx.isOwner,
      team: deps.resolveOwnerTeam?.(ctx) ?? null,
      onToggle: ctx.canToggleRole ? ctx.toggleViewPreview : undefined,
    };
  };
}

// The team that owns a team canvas (docs/specs/007-editor/editor-app.md "Role pill" in livediagram and livehuddle): its name from the person's own teams, or none known
// (a link visitor outside the team); null on a personal document.
export function resolveOwnerTeam(ctx: {
  documentTeamId: string | null;
  teams: readonly { id: string; name: string }[];
}): { name: string | null } | null {
  if (!ctx.documentTeamId) return null;
  return { name: ctx.teams.find((t) => t.id === ctx.documentTeamId)?.name ?? null };
}
