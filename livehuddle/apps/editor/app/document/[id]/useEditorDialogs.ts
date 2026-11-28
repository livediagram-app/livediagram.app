// The editor's dialog flags (@liveworkspace/workbench/hooks/editor/useEditorDialogs), bound to this editor's
// telemetry. livehuddle has no Tab Style dialog (docs/specs/002-project-scope/not-in-livehuddle.md "Tab style"), so
// its dialog-tab type is `never`.
import { createEditorDialogs } from '@liveworkspace/workbench/hooks/editor/useEditorDialogs';
import { track } from '@/lib/telemetry';

export const useEditorDialogs = createEditorDialogs<never>({ track });
