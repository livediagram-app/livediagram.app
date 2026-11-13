// Per-user editor preferences (docs/specs/007-editor/user-preferences.md), bound to this editor's
// lib/user-preferences (@liveworkspace/workbench/hooks/persistence/useEditorPreferences).
import { createEditorPreferences } from '@liveworkspace/workbench/hooks/persistence/useEditorPreferences';
import * as userPreferences from '@/lib/user-preferences';

export const { useEditorPreferences, useCachedPreferences } =
  createEditorPreferences<userPreferences.UserPreferences>(userPreferences);
