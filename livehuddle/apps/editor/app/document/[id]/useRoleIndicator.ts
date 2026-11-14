// What the role pill shows (@liveworkspace/workbench/hooks/editor/useRoleIndicator), read off this editor's context.
import { createUseRoleIndicator } from '@liveworkspace/workbench/hooks/editor/useRoleIndicator';
import { resolveOwnerBadge } from '@/lib/presence-rows';
import type { Role } from '@/components/chrome/RoleIndicator';
import { useEditorContext } from './EditorContext';

export const useRoleIndicator = createUseRoleIndicator<Role, ReturnType<typeof useEditorContext>>({
  useEditorContext,
  resolveOwnerBadge,
});
