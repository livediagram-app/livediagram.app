// The side effects of landing on a tab (@liveworkspace/workbench/hooks/editor/useTabEntryEffects), bound to this
// editor's addresses.
import { createTabEntryEffects } from '@liveworkspace/workbench/hooks/editor/useTabEntryEffects';
import { isEditorPath } from '@/lib/editor-path';

export const useTabEntryEffects = createTabEntryEffects(isEditorPath);
