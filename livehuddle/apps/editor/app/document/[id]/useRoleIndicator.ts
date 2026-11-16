// What the role pill shows (@liveworkspace/workbench/hooks/editor/useRoleIndicator), read off this editor's context.
import { createUseRoleIndicator } from '@liveworkspace/workbench/hooks/editor/useRoleIndicator';
import { resolveOwnerBadge } from '@/lib/presence-rows';
import type { Role } from '@/components/chrome/RoleIndicator';
import { useEditorContext } from './EditorContext';

// The team that owns a team canvas (editor-app.md "Role pill"): its name from the person's own teams, or none known
// (a link visitor outside the team); null on a personal document.
export function resolveOwnerTeam(ctx: {
  documentTeamId: string | null;
  teams: readonly { id: string; name: string }[];
}): { name: string | null } | null {
  if (!ctx.documentTeamId) return null;
  return { name: ctx.teams.find((t) => t.id === ctx.documentTeamId)?.name ?? null };
}

export const useRoleIndicator = createUseRoleIndicator<Role, ReturnType<typeof useEditorContext>>({
  useEditorContext,
  resolveOwnerBadge,
  resolveOwnerTeam,
});
