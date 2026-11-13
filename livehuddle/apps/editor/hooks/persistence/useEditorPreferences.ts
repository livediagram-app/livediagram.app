// Per-user editor preferences (docs/specs/007-editor/user-preferences.md), bound to this editor's
// lib/user-preferences (@liveworkspace/workbench/hooks/persistence/useEditorPreferences).
import { createEditorPreferences } from '@liveworkspace/workbench/hooks/persistence/useEditorPreferences';
import {
  fetchUserPreferences,
  PREFERENCES_CHANGED_EVENT,
  readUserPreferences,
  STORAGE_KEY,
  type UserPreferences,
} from '@/lib/user-preferences';

export const { useEditorPreferences } = createEditorPreferences<UserPreferences>({
  STORAGE_KEY,
  PREFERENCES_CHANGED_EVENT,
  readUserPreferences,
  fetchUserPreferences,
  // Arrows always reattach after a move (docs/specs/008-canvas/arrow-anchors.md): the Auto-Attach Arrows
  // switch left livehuddle (Work Tracker #423, part 4) and its stored value is not read. The drag and nudge
  // handlers keep taking the flag as a ref, so their own tests can still hold it off.
  autoRebindArrowsEnabled: () => true,
});
