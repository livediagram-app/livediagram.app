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
}) {
  return function useRoleIndicator(): {
    role: Role;
    ownerName: string | null;
    isSelf: boolean;
    onToggle?: () => void;
  } {
    const ctx = deps.useEditorContext();
    const owner = deps.resolveOwnerBadge(ctx);
    return {
      role: ctx.can.level,
      ownerName: owner?.name ?? null,
      isSelf: ctx.isOwner,
      onToggle: ctx.canToggleRole ? ctx.toggleViewPreview : undefined,
    };
  };
}
