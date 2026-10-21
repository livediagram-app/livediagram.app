import { resolveOwnerBadge } from '@/lib/presence-rows';
import type { Role } from '@/components/chrome/RoleIndicator';
import { useEditorContext } from './EditorContext';

// What the role pill and its Minimal chrome icon show
// (docs/specs/007-editor/live-app.md#role-pill): the role in force (view preview included), the
// owner it discloses, and the toggle when the session's role allows editing.
export function useRoleIndicator(): {
  role: Role;
  ownerName: string | null;
  isSelf: boolean;
  onToggle?: () => void;
} {
  const {
    isOwner,
    can,
    canToggleRole,
    toggleViewPreview,
    selfParticipant,
    livePresence,
    documentOwnerId,
    documentOwnerName,
    documentOwnerColor,
  } = useEditorContext();
  const owner = resolveOwnerBadge({
    isOwner,
    selfParticipant,
    livePresence,
    documentOwnerId,
    documentOwnerName,
    documentOwnerColor,
  });
  return {
    // The level in force (docs/specs/013-workspace/share-roles.md), the view preview included.
    role: can.level,
    ownerName: owner?.name ?? null,
    isSelf: isOwner,
    onToggle: canToggleRole ? toggleViewPreview : undefined,
  };
}
